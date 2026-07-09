import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nodeTransport } from "@familyquest/server-core/node";
import {
  parseServerMessage,
  type ClientMessage,
  type GameEvent,
  type GameState,
  type ServerMessage,
} from "@familyquest/shared";
import { GameSession } from "../src/session.js";
import { startGameServer } from "../src/gameServer.js";
import { createMockDM } from "../src/mockDm.js";
import type { RunningServer } from "@familyquest/server-core";

/**
 * Full-loop integration: real TCP, real WS framing, three simulated phones.
 * join → create characters → start adventure → dice roll → task → recovery
 * of a dropped player via token reconnect.
 */

const PORT = 18987;

class FakePhone {
  ws!: WebSocket;
  playerId = "";
  playerToken = "";
  state: GameState | null = null;
  events: GameEvent[] = [];
  errors: string[] = [];
  private waiters: { predicate: (p: FakePhone) => boolean; resolve: () => void }[] = [];

  async connect(): Promise<void> {
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    this.ws.addEventListener("message", (ev) => this.onMessage(String(ev.data)));
    await new Promise<void>((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener("error", () => reject(new Error("ws error")), { once: true });
    });
  }

  private onMessage(raw: string): void {
    const msg = parseServerMessage(raw) as ServerMessage | null;
    if (!msg) return;
    if (msg.type === "joined") {
      this.playerId = msg.playerId;
      this.playerToken = msg.playerToken;
    } else if (msg.type === "state:snapshot") {
      this.state = msg.state;
    } else if (msg.type === "event") {
      this.events.push(msg.event);
    } else if (msg.type === "error") {
      this.errors.push(msg.code);
    }
    this.waiters = this.waiters.filter((w) => {
      if (w.predicate(this)) {
        w.resolve();
        return false;
      }
      return true;
    });
  }

  send(msg: ClientMessage): void {
    this.ws.send(JSON.stringify(msg));
  }

  waitFor(predicate: (p: FakePhone) => boolean, timeoutMs = 4000): Promise<void> {
    if (predicate(this)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("timeout waiting for condition")),
        timeoutMs,
      );
      this.waiters.push({
        predicate,
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
      });
    });
  }

  eventsOf<K extends GameEvent["kind"]>(kind: K): Extract<GameEvent, { kind: K }>[] {
    return this.events.filter((e): e is Extract<GameEvent, { kind: K }> => e.kind === kind);
  }
}

let session: GameSession;
let server: RunningServer;

beforeAll(async () => {
  session = new GameSession({
    gameId: "test-game",
    language: "en",
    shows: ["Bluey", "Star Wars"],
    heartbeatMs: 60_000,
    createDM: createMockDM({
      wordDelayMs: 0,
      getPlayerIds: () =>
        Object.keys(session.getState().players).filter(
          (id) => session.getState().characters[id],
        ),
    }),
  });
  server = await startGameServer({
    transport: nodeTransport,
    session,
    assets: new Map(),
    port: PORT,
    host: "127.0.0.1",
  });
  await session.prepareWorld();
});

afterAll(async () => {
  session.close();
  await server.close();
});

describe("full game loop over real sockets", () => {
  const ayse = new FakePhone();
  const can = new FakePhone();

  it("players join and receive snapshots with world concepts", async () => {
    await ayse.connect();
    ayse.send({ type: "join", gameId: "test-game", name: "Ayşe" });
    await ayse.waitFor((p) => p.playerId !== "" && p.state !== null);
    expect(ayse.state!.setup.concepts.length).toBeGreaterThan(0);
    expect(ayse.state!.setup.worldBible?.title).toContain("Bluey");

    await can.connect();
    can.send({ type: "join", gameId: "test-game", name: "Can" });
    await can.waitFor((p) => p.playerId !== "");

    // Ayşe hears about Can joining.
    await ayse.waitFor((p) => p.eventsOf("player-joined").some((e) => e.player.name === "Can"));
  });

  it("rejects a join to a wrong game id", async () => {
    const stranger = new FakePhone();
    await stranger.connect();
    stranger.send({ type: "join", gameId: "nope", name: "X" });
    await stranger.waitFor((p) => p.errors.includes("GAME_NOT_FOUND"));
    stranger.ws.close();
  });

  it("both players create characters; everyone sees them", async () => {
    ayse.send({
      type: "character:create",
      name: "Nova",
      species: "Star Puppy",
      avatar: { emoji: "🐶", color: "sky" },
      stats: { brave: 3, smart: 2, charm: 2, sneaky: 1 },
    });
    can.send({
      type: "character:create",
      name: "Miko",
      species: "Cloud Fox",
      avatar: { emoji: "🦊", color: "tangerine", accessory: "🎩" },
      stats: { brave: 1, smart: 3, charm: 1, sneaky: 3 },
    });
    await ayse.waitFor((p) => p.eventsOf("character-created").length >= 2);
    expect(session.getState().characters[ayse.playerId]?.name).toBe("Nova");
    expect(session.getState().characters[can.playerId]?.name).toBe("Miko");
  });

  it("rejects invalid stat totals", async () => {
    const cheat = new FakePhone();
    await cheat.connect();
    cheat.send({ type: "join", gameId: "test-game", name: "Cheater" });
    await cheat.waitFor((p) => p.playerId !== "");
    cheat.send({
      type: "character:create",
      name: "Maxed",
      species: "Cheat",
      avatar: { emoji: "👾", color: "mint" },
      stats: { brave: 4, smart: 4, charm: 4, sneaky: 4 }, // sums to 16
    });
    await cheat.waitFor((p) => p.errors.includes("INVALID_MESSAGE"));
    cheat.ws.close();
  });

  it("adventure starts: scene, streamed narration, then a dice request", async () => {
    const adventure = session.startAdventure(); // runs the whole scripted scene

    await ayse.waitFor((p) => p.eventsOf("scene-changed").length > 0);
    await ayse.waitFor((p) => p.eventsOf("narration-done").length > 0);
    const narration = ayse
      .eventsOf("narration-chunk")
      .map((e) => e.text)
      .join("");
    expect(narration).toContain("magical map");

    // The mock DM asks the first character-holder (Ayşe) to roll.
    await ayse.waitFor((p) => p.eventsOf("dice-requested").length > 0);
    const request = ayse.eventsOf("dice-requested")[0]!.request;
    expect(request.playerId).toBe(ayse.playerId);

    // A different player cannot steal the roll.
    can.send({ type: "dice:roll", requestId: request.requestId });
    await can.waitFor((p) => p.errors.includes("NOT_YOUR_TURN"));

    // The right player rolls; everyone sees the authoritative result.
    ayse.send({ type: "dice:roll", requestId: request.requestId });
    await can.waitFor((p) => p.eventsOf("dice-resolved").length > 0);
    const result = can.eventsOf("dice-resolved")[0]!.result;
    expect(result.raw).toBeGreaterThanOrEqual(1);
    expect(result.raw).toBeLessThanOrEqual(20);
    expect(result.bonus).toBe(3); // Nova's brave

    // Next the mock DM assigns Can a task.
    await can.waitFor((p) => p.eventsOf("task-assigned").length > 0);
    const task = can.eventsOf("task-assigned")[0]!.task;
    expect(task.playerId).toBe(can.playerId);
    can.send({ type: "action:submit", taskId: task.taskId, freeText: "Why did the cloud blush? It saw the rainbow!" });

    await adventure; // scripted scene completes without error
    const log = session.getState().log;
    expect(log.some((e) => e.kind === "dice")).toBe(true);
    expect(log.some((e) => e.kind === "task")).toBe(true);
  });

  it("reconnect with token restores identity and marks online", async () => {
    const oldId = ayse.playerId;
    ayse.ws.close();
    await can.waitFor((p) =>
      p.eventsOf("player-connection").some((e) => e.playerId === oldId && e.connection === "offline"),
    );

    const phoenix = new FakePhone();
    await phoenix.connect();
    phoenix.send({ type: "join", gameId: "test-game", playerToken: ayse.playerToken });
    await phoenix.waitFor((p) => p.playerId !== "" && p.state !== null);
    expect(phoenix.playerId).toBe(oldId);
    expect(phoenix.state!.characters[oldId]?.name).toBe("Nova");

    await can.waitFor((p) =>
      p.eventsOf("player-connection").some((e) => e.playerId === oldId && e.connection === "online"),
    );
    phoenix.ws.close();
  });

  it("rejects a bad token", async () => {
    const impostor = new FakePhone();
    await impostor.connect();
    impostor.send({ type: "join", gameId: "test-game", playerToken: "forged-token" });
    await impostor.waitFor((p) => p.errors.includes("BAD_TOKEN"));
    impostor.ws.close();
    can.ws.close();
  });
});
