import {
  parseHostServerMessage,
  type Audience,
  type Avatar,
  type DMErrorKind,
  type DMModel,
  type GameState,
  type HostClientMessage,
  type HostServerErrorCode,
  type Language,
  type PlayerId,
  type Stats,
  type UsageTotals,
} from "@familyquest/shared";

/**
 * The host app's link to the game server: one `/host` WebSocket that creates
 * a game and remote-controls it. Exponential-backoff reconnect replays
 * `host:reattach` with the stored token, so a locked phone never orphans the
 * family's adventure.
 */

const BACKOFF_START_MS = 500;
const BACKOFF_MAX_MS = 5000;
const MAX_ATTEMPTS = 20;
const PING_MS = 15_000;

export interface NewGameParams {
  shows: string[];
  audience: Audience;
  language: Language;
  model: DMModel;
}

export interface RemoteGameCallbacks {
  onCreated(info: { gameId: string; joinUrl: string }): void;
  onState(state: GameState): void;
  onNarration(messageId: string, text: string, done: boolean): void;
  onUsage(totals: UsageTotals): void;
  onDmError(kind: DMErrorKind): void;
  onHostPlayer(playerId: PlayerId): void;
  /** Fatal server-side rejections (bad passcode, game gone, server full). */
  onServerError(code: HostServerErrorCode, message: string): void;
  /** Transient drop — reconnecting in the background. */
  onConnectionLost(): void;
  onConnectionRestored(): void;
  /** Reconnect attempts exhausted. */
  onFailed(): void;
}

const FATAL_CODES: HostServerErrorCode[] = [
  "BAD_HOST_KEY",
  "GAME_NOT_FOUND",
  "BAD_TOKEN",
  "SERVER_FULL",
];

export class RemoteGame {
  private ws: WebSocket | null = null;
  private attempts = 0;
  private closedByUs = false;
  private gameId: string | null = null;
  private hostToken: string | null = null;
  private pendingCreate: NewGameParams | null = null;
  private pinger: ReturnType<typeof setInterval> | null = null;
  /** Messages sent while the socket was down — flushed after (re)attach. */
  private outbox: HostClientMessage[] = [];

  constructor(
    private readonly serverAddress: string,
    private readonly hostKey: string,
    private readonly callbacks: RemoteGameCallbacks,
  ) {}

  /** Connect and create a fresh game. */
  start(params: NewGameParams): void {
    this.pendingCreate = params;
    this.closedByUs = false;
    this.open();
  }

  createCharacter(draft: { name: string; species: string; avatar: Avatar; stats: Stats }): void {
    this.send({ type: "host:character", ...draft });
  }

  startAdventure(): void {
    this.send({ type: "host:start" });
  }

  nudge(instruction?: string): void {
    this.send({ type: "host:nudge", ...(instruction ? { instruction } : {}) });
  }

  /** End the adventure for everyone — the server forgets the game. */
  end(): void {
    this.send({ type: "host:end" });
    this.closedByUs = true;
    this.stopPing();
    this.ws?.close();
  }

  /** Detach without killing the game (app shutting down). */
  close(): void {
    this.closedByUs = true;
    this.stopPing();
    this.ws?.close();
  }

  private open(): void {
    const ws = new WebSocket(`ws://${this.serverAddress}/host`);
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      if (this.pendingCreate) {
        const p = this.pendingCreate;
        this.pendingCreate = null;
        this.send({ type: "host:create", hostKey: this.hostKey, ...p });
      } else if (this.gameId && this.hostToken) {
        this.send({
          type: "host:reattach",
          hostKey: this.hostKey,
          gameId: this.gameId,
          hostToken: this.hostToken,
        });
      }
      this.startPing();
    };

    ws.onmessage = (ev) => this.handleMessage(String(ev.data));

    ws.onclose = () => {
      this.stopPing();
      if (this.closedByUs) return;
      if (this.attempts >= MAX_ATTEMPTS) {
        this.callbacks.onFailed();
        return;
      }
      // Nothing to resume and nothing pending — treat as done.
      if (!this.pendingCreate && !(this.gameId && this.hostToken)) return;
      this.callbacks.onConnectionLost();
      const delay = Math.min(BACKOFF_START_MS * 2 ** this.attempts, BACKOFF_MAX_MS);
      this.attempts += 1;
      setTimeout(() => {
        if (!this.closedByUs) this.open();
      }, delay);
    };

    ws.onerror = () => {
      // onclose fires after; reconnect logic lives there.
    };
  }

  private handleMessage(raw: string): void {
    const msg = parseHostServerMessage(raw);
    if (!msg) return;

    switch (msg.type) {
      case "host:created":
        this.gameId = msg.gameId;
        this.hostToken = msg.hostToken;
        this.callbacks.onCreated({ gameId: msg.gameId, joinUrl: msg.joinUrl });
        this.flushOutbox();
        break;
      case "host:reattached":
        this.callbacks.onConnectionRestored();
        this.flushOutbox();
        break;
      case "host:player":
        this.callbacks.onHostPlayer(msg.playerId);
        break;
      case "state":
        this.callbacks.onState(msg.state);
        break;
      case "narration":
        this.callbacks.onNarration(msg.messageId, msg.text, msg.done);
        break;
      case "usage":
        this.callbacks.onUsage(msg.totals);
        break;
      case "dmError":
        this.callbacks.onDmError(msg.kind);
        break;
      case "error":
        if (FATAL_CODES.includes(msg.code)) {
          this.closedByUs = true; // don't reconnect into the same rejection
          this.callbacks.onServerError(msg.code, msg.message);
        }
        break;
      case "pong":
        break;
    }
  }

  private send(message: HostClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return;
    }
    // Never silently drop a game action while reconnecting (a lost
    // `host:start` used to leave the whole table in dead air). Pings and the
    // handshake messages are connection-scoped and must not be replayed.
    if (message.type === "host:start" || message.type === "host:nudge" || message.type === "host:character" || message.type === "host:end") {
      this.outbox.push(message);
    }
  }

  /** Replay actions that were attempted while the socket was down. */
  private flushOutbox(): void {
    const queued = this.outbox;
    this.outbox = [];
    for (const message of queued) this.send(message);
  }

  private startPing(): void {
    this.stopPing();
    this.pinger = setInterval(() => this.send({ type: "ping" }), PING_MS);
  }

  private stopPing(): void {
    if (this.pinger) {
      clearInterval(this.pinger);
      this.pinger = null;
    }
  }
}
