import {
  applyEvent,
  createInitialGameState,
  MAX_HP,
  MAX_PLAYERS,
  parseClientMessage,
  resolveCheck,
  rollD20,
  serializeServerMessage,
  type AdventureLogEntry,
  type Audience,
  type Character,
  type ClientMessage,
  type GameEvent,
  type GameState,
  type Item,
  type Language,
  type PlayerId,
  type RollResult,
  type Scene,
  type ServerErrorCode,
  type ServerMessage,
  type StatName,
} from "@familyquest/shared";
import { generateToken, Hub, type HubClient, type WsConnection } from "@familyquest/server-core";
import { DMError, type AttributedAction, type DMActions, type DMEngine, type DMEngineFactory } from "./dmTypes.js";

interface PlayerRecord {
  playerId: PlayerId;
  token: string;
}

export interface GameSessionOptions {
  gameId: string;
  language: Language;
  shows: string[];
  audience?: Audience;
  createDM: DMEngineFactory;
  /** Heartbeat tuning (mostly for tests). */
  heartbeatMs?: number;
  onError?: (err: unknown) => void;
  /** Narration stream for the host's own table view (players get it via WS). */
  onNarration?: (messageId: string, text: string, done: boolean) => void;
}

type SessionListener = (state: GameState) => void;

/**
 * The single source of truth for one running game. Lives on the host phone
 * (or the devhost). Owns the state, validates every player input, rolls the
 * dice, and drives the DM engine.
 */
export class GameSession implements DMActions {
  readonly hub: Hub;
  private state: GameState;
  private seq = 0;
  private tokens = new Map<string, PlayerRecord>(); // token → player
  private nextPlayerNum = 1;
  private nextId = 1;
  private dm: DMEngine;
  private listeners = new Set<SessionListener>();
  private narrationBuffers = new Map<string, string>();

  private pendingDice = new Map<string, (result: RollResult) => void>();
  private pendingTasks = new Map<string, (answer: string) => void>();

  constructor(private readonly options: GameSessionOptions) {
    this.state = createInitialGameState(
      options.gameId,
      options.language,
      options.shows,
      options.audience ?? "family",
    );
    this.hub = new Hub({
      heartbeatMs: options.heartbeatMs,
      onClientClosed: (client) => this.handleClientClosed(client),
    });
    this.dm = options.createDM(this);
  }

  // -------------------------------------------------------------------------
  // Host-side API (UI / devhost)
  // -------------------------------------------------------------------------

  getState(): GameState {
    return this.state;
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Generate world + concepts (call once after creating the session). */
  async prepareWorld(): Promise<void> {
    const world = await this.dm.generateWorld(this.state.setup.shows, this.state.language);
    this.state = {
      ...this.state,
      setup: { ...this.state.setup, worldBible: world },
    };
    const concepts = await this.dm.generateConcepts(world, this.state.language, 6);
    this.applyAndBroadcast({ kind: "concepts-ready", concepts });
  }

  /** Add the host themself as a player (host plays too). */
  addHostPlayer(name: string): PlayerId {
    const playerId = `p${this.nextPlayerNum++}`;
    this.applyAndBroadcast({
      kind: "player-joined",
      player: { playerId, name, connection: "online", isHost: true },
    });
    return playerId;
  }

  /** Host-side character creation (host UI bypasses the WS). */
  createCharacterFor(playerId: PlayerId, draft: Omit<Character, "hp" | "maxHp" | "items" | "status">): void {
    const character: Character = { ...draft, hp: MAX_HP, maxHp: MAX_HP, items: [], status: "ok" };
    this.applyAndBroadcast({ kind: "character-created", playerId, character });
  }

  async startAdventure(): Promise<void> {
    // Idempotent: the host app may resend `host:start` after a reconnect.
    if (this.state.phase !== "lobby" && this.state.phase !== "characterCreation") return;
    this.applyAndBroadcast({ kind: "phase-changed", phase: "playing" });
    await this.runDM(() => this.dm.startAdventure());
  }

  async nudge(instruction: string): Promise<void> {
    await this.runDM(() => this.dm.nudge(instruction));
  }

  pause(): void {
    this.applyAndBroadcast({ kind: "phase-changed", phase: "paused" });
  }

  resume(): void {
    this.applyAndBroadcast({ kind: "phase-changed", phase: "playing" });
  }

  close(): void {
    this.dm.cancel();
    this.hub.closeAll();
  }

  private async runDM(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.options.onError?.(err);
      // Players otherwise have no signal at all when a DM turn dies.
      this.broadcast({
        kind: "dm-error",
        errorKind: err instanceof DMError ? err.kind : "unknown",
      });
    }
  }

  // -------------------------------------------------------------------------
  // WebSocket plumbing
  // -------------------------------------------------------------------------

  /** Wire a fresh WS connection into this session. */
  attach(ws: WsConnection): void {
    const client = this.hub.add(ws);
    ws.onMessage((raw) => this.handleMessage(client, raw));
  }

  private handleMessage(client: HubClient, raw: string): void {
    const msg = parseClientMessage(raw);
    if (!msg) {
      this.sendError(client, "INVALID_MESSAGE", "Could not understand that message.");
      return;
    }

    switch (msg.type) {
      case "join":
        this.handleJoin(client, msg);
        break;
      case "character:create":
        this.handleCharacterCreate(client, msg);
        break;
      case "dice:roll":
        this.handleDiceRoll(client, msg.requestId);
        break;
      case "action:submit":
        this.handleActionSubmit(client, msg);
        break;
      case "ping":
        client.ws.sendText(serializeServerMessage({ type: "pong" }));
        break;
    }
  }

  private handleJoin(
    client: HubClient,
    msg: Extract<ClientMessage, { type: "join" }>,
  ): void {
    if (msg.gameId !== this.state.gameId) {
      this.sendError(client, "GAME_NOT_FOUND", "No such adventure on this host.");
      return;
    }

    // Reconnect path
    if (msg.playerToken) {
      const record = this.tokens.get(msg.playerToken);
      if (!record) {
        this.sendError(client, "BAD_TOKEN", "Unknown session token.");
        return;
      }
      // Drop any lingering old socket for this player.
      const stale = this.hub.byPlayer(record.playerId);
      if (stale && stale !== client) stale.ws.close(1001);

      client.playerId = record.playerId;
      this.completeJoin(client, record);
      this.applyAndBroadcast({
        kind: "player-connection",
        playerId: record.playerId,
        connection: "online",
      });
      return;
    }

    // Fresh join
    if (!msg.name) {
      this.sendError(client, "INVALID_MESSAGE", "A name is required to join.");
      return;
    }
    if (Object.keys(this.state.players).length >= MAX_PLAYERS) {
      this.sendError(client, "GAME_FULL", "The party is full.");
      return;
    }

    const playerId = `p${this.nextPlayerNum++}`;
    const token = generateToken();
    const record: PlayerRecord = { playerId, token };
    this.tokens.set(token, record);
    client.playerId = playerId;

    this.applyAndBroadcast({
      kind: "player-joined",
      player: { playerId, name: msg.name, connection: "online", isHost: false },
    });
    this.completeJoin(client, record);
  }

  private completeJoin(client: HubClient, record: PlayerRecord): void {
    const snapshotSeq = this.seq;
    this.sendTo(client, {
      type: "joined",
      playerId: record.playerId,
      playerToken: record.token,
      snapshotSeq,
    });
    this.sendTo(client, { type: "state:snapshot", seq: snapshotSeq, state: this.state });
  }

  private handleCharacterCreate(
    client: HubClient,
    msg: Extract<ClientMessage, { type: "character:create" }>,
  ): void {
    const playerId = client.playerId;
    if (!playerId) return;
    if (this.state.characters[playerId]) {
      this.sendError(client, "ALREADY_HAS_CHARACTER", "You already created a character.");
      return;
    }
    // Stat ranges are schema-validated; the sum rule is enforced here.
    const total = Object.values(msg.stats).reduce((a, b) => a + b, 0);
    if (total !== 8) {
      this.sendError(client, "INVALID_MESSAGE", "Stat points must add up to 8.");
      return;
    }

    const character: Character = {
      name: msg.name,
      species: msg.species,
      avatar: msg.avatar,
      stats: msg.stats,
      hp: MAX_HP,
      maxHp: MAX_HP,
      items: [],
      status: "ok",
    };
    this.applyAndBroadcast({ kind: "character-created", playerId, character });
    this.log("system", `${msg.name} joined the party`, playerId);
  }

  private handleDiceRoll(client: HubClient, requestId: string): void {
    const playerId = client.playerId;
    if (!playerId) return;
    const request = this.state.pending.rolls[requestId];
    if (!request || request.playerId !== playerId) {
      this.sendError(client, "NOT_YOUR_TURN", "That roll isn't waiting on you.");
      return;
    }

    const character = this.state.characters[playerId];
    const bonus = character ? character.stats[request.stat] : 0;
    const result = resolveCheck(rollD20(), bonus, request.dc);

    this.applyAndBroadcast({ kind: "dice-resolved", requestId, playerId, result });
    this.log(
      "dice",
      `${character?.name ?? "?"} rolled ${result.total} (${result.outcome}) for ${request.reason}`,
      playerId,
    );

    const resolver = this.pendingDice.get(requestId);
    this.pendingDice.delete(requestId);
    resolver?.(result);
  }

  private handleActionSubmit(
    client: HubClient,
    msg: Extract<ClientMessage, { type: "action:submit" }>,
  ): void {
    const playerId = client.playerId;
    if (!playerId) return;

    // Task answer
    if (msg.taskId) {
      const task = this.state.pending.tasks[msg.taskId];
      if (!task || task.playerId !== playerId) {
        this.sendError(client, "NOT_YOUR_TURN", "That task isn't waiting on you.");
        return;
      }
      const choiceLabel = task.choices?.find((c) => c.id === msg.choiceId)?.label;
      const answer = choiceLabel ?? msg.freeText ?? "";
      if (!answer) return;

      this.applyAndBroadcast({ kind: "task-resolved", taskId: msg.taskId, playerId, answer });
      this.log("task", `${this.characterName(playerId)}: ${answer}`, playerId);

      const resolver = this.pendingTasks.get(msg.taskId);
      this.pendingTasks.delete(msg.taskId);
      resolver?.(answer);
      return;
    }

    // Open-floor free text → forward to the DM
    if (!msg.freeText) return;
    if (this.state.phase !== "playing") return;
    const action: AttributedAction = {
      playerId,
      playerName: this.state.players[playerId]?.name ?? "?",
      characterName: this.characterName(playerId),
      text: msg.freeText,
    };
    this.log("system", `${action.characterName}: ${action.text}`, playerId);
    void this.runDM(() => this.dm.playerAction(action));
  }

  private handleClientClosed(client: HubClient): void {
    if (!client.playerId) return;
    // A newer socket may have already replaced this one (reconnect).
    if (this.hub.byPlayer(client.playerId)) return;
    if (!this.state.players[client.playerId]) return;
    this.applyAndBroadcast({
      kind: "player-connection",
      playerId: client.playerId,
      connection: "offline",
    });
  }

  // -------------------------------------------------------------------------
  // DMActions — the DM's hands
  // -------------------------------------------------------------------------

  narrationChunk(messageId: string, text: string): void {
    this.narrationBuffers.set(messageId, (this.narrationBuffers.get(messageId) ?? "") + text);
    this.broadcast({ kind: "narration-chunk", messageId, text });
    this.options.onNarration?.(messageId, text, false);
  }

  narrationDone(messageId: string): void {
    const full = this.narrationBuffers.get(messageId);
    this.narrationBuffers.delete(messageId);
    if (full?.trim()) this.log("narration", full.trim());
    this.broadcast({ kind: "narration-done", messageId });
    this.options.onNarration?.(messageId, "", true);
  }

  setScene(scene: Omit<Scene, "id">): void {
    const full: Scene = { id: this.newId("scene"), ...scene };
    this.applyAndBroadcast({ kind: "scene-changed", scene: full });
    this.log("scene", `— ${scene.title} —`);
  }

  requestDiceRoll(input: {
    playerId: PlayerId;
    stat: StatName;
    dc: number;
    reason: string;
  }): Promise<RollResult> {
    const requestId = this.newId("roll");
    return new Promise<RollResult>((resolve) => {
      this.pendingDice.set(requestId, resolve);
      this.applyAndBroadcast({
        kind: "dice-requested",
        request: { requestId, ...input },
      });
    });
  }

  assignTask(input: {
    playerId: PlayerId;
    prompt: string;
    choices?: { id: string; label: string }[];
  }): Promise<string> {
    const taskId = this.newId("task");
    return new Promise<string>((resolve) => {
      this.pendingTasks.set(taskId, resolve);
      this.applyAndBroadcast({ kind: "task-assigned", task: { taskId, ...input } });
    });
  }

  awardItem(playerId: PlayerId, item: Item): void {
    this.applyAndBroadcast({ kind: "item-awarded", playerId, item });
    this.log("item", `${this.characterName(playerId)} received ${item.emoji} ${item.name}`, playerId);
  }

  updateHp(playerId: PlayerId, delta: number, reason?: string): void {
    const character = this.state.characters[playerId];
    if (!character) return;
    const hp = Math.min(Math.max(character.hp + delta, 0), character.maxHp);
    this.applyAndBroadcast({ kind: "hp-changed", playerId, hp, delta, reason });
    if (hp === 0) {
      this.log("status", `${this.characterName(playerId)} is knocked out!`, playerId);
    }
  }

  setCharacterStatus(playerId: PlayerId, status: "ok" | "knockedOut" | "rescued"): void {
    this.applyAndBroadcast({ kind: "character-status", playerId, status });
  }

  endScene(summary: string): void {
    this.log("scene", `Scene complete: ${summary}`);
    this.notify();
  }

  endAdventure(epilogue: string): void {
    this.applyAndBroadcast({ kind: "game-ended", epilogue });
    this.log("narration", epilogue);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private characterName(playerId: PlayerId): string {
    return this.state.characters[playerId]?.name ?? this.state.players[playerId]?.name ?? "?";
  }

  private newId(prefix: string): string {
    return `${prefix}_${this.nextId++}`;
  }

  private log(kind: AdventureLogEntry["kind"], text: string, playerId?: PlayerId): void {
    this.state = {
      ...this.state,
      log: [
        ...this.state.log,
        { id: this.newId("log"), at: Date.now(), kind, text, playerId },
      ],
    };
    this.notify();
  }

  /** Apply to authoritative state, then broadcast the delta. */
  private applyAndBroadcast(event: GameEvent): void {
    this.state = applyEvent(this.state, event);
    this.broadcast(event);
    this.notify();
  }

  /** Broadcast without state change (narration chunks). */
  private broadcast(event: GameEvent): void {
    this.seq += 1;
    this.hub.broadcast(serializeServerMessage({ type: "event", seq: this.seq, event }));
  }

  private sendTo(client: HubClient, msg: ServerMessage): void {
    client.ws.sendText(serializeServerMessage(msg));
  }

  private sendError(client: HubClient, code: ServerErrorCode, message: string): void {
    this.sendTo(client, { type: "error", code, message });
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.state);
  }
}
