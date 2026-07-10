import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  parseHostServerMessage,
  parseServerMessage,
  type ClientMessage,
  type GameState,
  type HostClientMessage,
  type HostServerMessage,
  type ServerMessage,
} from "@familyquest/shared";
import type { RunningServer } from "@familyquest/server-core";
import { GameManager } from "../src/games.js";
import { startApp } from "../src/app.js";

/**
 * Full-loop integration against a real TCP server: the host app creates a
 * game over /host (passcode-gated), a player joins over /ws?g=<id>, the
 * adventure starts, and the host reattaches with its token.
 */

const PORT = 18988;
const HOST_KEY = "family-secret";

let server: RunningServer;
let games: GameManager;

beforeAll(async () => {
  games = new GameManager({
    anthropicApiKey: null,
    mockDM: true,
    maxGames: 5,
    gameTtlMs: 60_000,
    mockWordDelayMs: 0,
  });
  server = await startApp({
    port: PORT,
    hostKey: HOST_KEY,
    publicOrigin: null,
    assets: new Map(),
    games,
  });
});

afterAll(async () => {
  games.closeAll();
  await server.close();
});

class WsClient<In, Out> {
  ws!: WebSocket;
  received: In[] = [];
  closed = false;
  private waiters: { predicate: () => boolean; resolve: () => void }[] = [];

  constructor(
    private readonly path: string,
    private readonly parse: (raw: string) => In | null,
  ) {}

  async connect(): Promise<void> {
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}${this.path}`);
    this.ws.addEventListener("message", (ev) => {
      const msg = this.parse(String(ev.data));
      if (!msg) return;
      this.received.push(msg);
      this.settle();
    });
    this.ws.addEventListener("close", () => {
      this.closed = true;
      this.settle();
    });
    await new Promise<void>((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener("error", () => reject(new Error("ws error")), { once: true });
    });
  }

  send(msg: Out): void {
    this.ws.send(JSON.stringify(msg));
  }

  private settle(): void {
    this.waiters = this.waiters.filter((w) => {
      if (w.predicate()) {
        w.resolve();
        return false;
      }
      return true;
    });
  }

  waitFor(predicate: () => boolean, timeoutMs = 4000): Promise<void> {
    if (predicate()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout waiting for condition")), timeoutMs);
      this.waiters.push({
        predicate,
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
      });
    });
  }
}

class HostApp extends WsClient<HostServerMessage, HostClientMessage> {
  constructor() {
    super("/host", parseHostServerMessage);
  }
  get state(): GameState | null {
    for (let i = this.received.length - 1; i >= 0; i--) {
      const msg = this.received[i];
      if (msg?.type === "state") return msg.state;
    }
    return null;
  }
  find<T extends HostServerMessage["type"]>(type: T) {
    return this.received.find((m) => m.type === type) as
      | Extract<HostServerMessage, { type: T }>
      | undefined;
  }
}

class PlayerPhone extends WsClient<ServerMessage, ClientMessage> {
  constructor(gameId: string) {
    super(`/ws?g=${gameId}`, parseServerMessage);
  }
}

describe("family quest server", () => {
  let gameId = "";
  let hostToken = "";
  let joinUrl = "";

  it("rejects a wrong passcode", async () => {
    const host = new HostApp();
    await host.connect();
    host.send({
      type: "host:create",
      hostKey: "wrong",
      shows: ["Bluey"],
      audience: "family",
      language: "en",
      model: "claude-opus-4-8",
    });
    await host.waitFor(() => host.received.some((m) => m.type === "error") && host.closed);
    const err = host.find("error");
    expect(err?.code).toBe("BAD_HOST_KEY");
    expect(games.size).toBe(0);
  });

  it("creates a game and builds the world", async () => {
    const host = new HostApp();
    await host.connect();
    host.send({
      type: "host:create",
      hostKey: HOST_KEY,
      shows: ["Bluey", "Star Wars"],
      audience: "family",
      language: "en",
      model: "claude-opus-4-8",
    });
    await host.waitFor(() => Boolean(host.find("host:created")));
    const created = host.find("host:created")!;
    gameId = created.gameId;
    hostToken = created.hostToken;
    joinUrl = created.joinUrl;
    expect(joinUrl).toContain(`/join?g=${gameId}`);
    expect(games.size).toBe(1);

    // Mock DM builds the world; concepts land in state.
    await host.waitFor(() => (host.state?.setup.concepts.length ?? 0) > 0);
    expect(host.state?.setup.worldBible?.title).toContain("Bluey");

    // Host creates their own character over the channel.
    host.send({
      type: "host:character",
      name: "Mama Bear",
      species: "Cloud Fox",
      avatar: { emoji: "🦊", color: "peach" },
      stats: { brave: 2, smart: 2, charm: 2, sneaky: 2 },
    });
    await host.waitFor(() => Boolean(host.find("host:player")));
    const hostPlayerId = host.find("host:player")!.playerId;
    expect(host.state?.characters[hostPlayerId]?.name).toBe("Mama Bear");
  });

  it("rejects players for unknown games", async () => {
    const lost = new PlayerPhone("nope42");
    await lost.connect();
    await lost.waitFor(() => lost.received.some((m) => m.type === "error"));
    const err = lost.received.find((m) => m.type === "error");
    expect(err && err.type === "error" && err.code).toBe("GAME_NOT_FOUND");
  });

  it("lets a player join and the adventure start", async () => {
    const player = new PlayerPhone(gameId);
    await player.connect();
    player.send({ type: "join", gameId, name: "Kiddo" });
    await player.waitFor(() => player.received.some((m) => m.type === "joined"));

    const joined = player.received.find((m) => m.type === "joined");
    const playerId = joined && joined.type === "joined" ? joined.playerId : "";
    player.send({
      type: "character:create",
      name: "Nova",
      species: "Star Puppy",
      avatar: { emoji: "🐶", color: "sky" },
      stats: { brave: 3, smart: 1, charm: 3, sneaky: 1 },
    });
    await player.waitFor(() =>
      player.received.some(
        (m) => m.type === "event" && m.event.kind === "character-created" && m.event.playerId === playerId,
      ),
    );

    // Reattach a fresh host connection (phone locked, app reopened).
    const host = new HostApp();
    await host.connect();
    host.send({ type: "host:reattach", hostKey: HOST_KEY, gameId, hostToken: "bogus" });
    await host.waitFor(() => host.received.some((m) => m.type === "error"));
    expect(host.find("error")?.code).toBe("BAD_TOKEN");

    const host2 = new HostApp();
    await host2.connect();
    host2.send({ type: "host:reattach", hostKey: HOST_KEY, gameId, hostToken });
    await host2.waitFor(() => Boolean(host2.find("host:reattached")));
    expect(host2.find("host:reattached")?.hostPlayerId).toBeTruthy();
    expect(host2.state?.players[playerId]?.name).toBe("Kiddo");

    // Start the adventure — narration streams to the host, events to players.
    host2.send({ type: "host:start" });
    await host2.waitFor(() => host2.state?.phase === "playing");
    await host2.waitFor(() => host2.received.some((m) => m.type === "narration"));
    await player.waitFor(() =>
      player.received.some((m) => m.type === "event" && m.event.kind === "narration-chunk"),
    );

    // Host ends the game; server forgets it.
    host2.send({ type: "host:end" });
    await host2.waitFor(() => host2.closed);
    expect(games.size).toBe(0);
  });
});
