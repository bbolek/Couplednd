import { describe, expect, it } from "vitest";
import { createInitialGameState, type Character } from "../src/gameState.js";
import { applyEvent } from "../src/reducers.js";

const character: Character = {
  name: "Nova",
  species: "Heeler Padawan",
  avatar: { emoji: "🐶", color: "sky" },
  stats: { brave: 3, smart: 2, charm: 2, sneaky: 1 },
  hp: 6,
  maxHp: 6,
  items: [],
  status: "ok",
};

function baseState() {
  let s = createInitialGameState("g1", "en", ["Bluey", "Star Wars"], "family", 0);
  s = applyEvent(s, {
    kind: "player-joined",
    player: { playerId: "p1", name: "Ayşe", connection: "online", isHost: false },
  });
  s = applyEvent(s, { kind: "character-created", playerId: "p1", character });
  return s;
}

describe("applyEvent", () => {
  it("adds players and characters", () => {
    const s = baseState();
    expect(s.players.p1?.name).toBe("Ayşe");
    expect(s.characters.p1?.name).toBe("Nova");
  });

  it("dice request parks the phase; resolution releases it", () => {
    let s = baseState();
    s = applyEvent(s, { kind: "phase-changed", phase: "playing" });
    s = applyEvent(s, {
      kind: "dice-requested",
      request: { requestId: "r1", playerId: "p1", stat: "sneaky", dc: 10, reason: "sneak" },
    });
    expect(s.phase).toBe("awaitingRoll");
    expect(s.pending.rolls.r1).toBeDefined();

    s = applyEvent(s, {
      kind: "dice-resolved",
      requestId: "r1",
      playerId: "p1",
      result: { raw: 14, bonus: 1, total: 15, dc: 10, outcome: "success" },
    });
    expect(s.phase).toBe("playing");
    expect(s.pending.rolls.r1).toBeUndefined();
  });

  it("keeps waiting if another pending roll remains", () => {
    let s = baseState();
    s = applyEvent(s, {
      kind: "dice-requested",
      request: { requestId: "r1", playerId: "p1", stat: "brave", dc: 10, reason: "a" },
    });
    s = applyEvent(s, {
      kind: "dice-requested",
      request: { requestId: "r2", playerId: "p1", stat: "smart", dc: 5, reason: "b" },
    });
    s = applyEvent(s, {
      kind: "dice-resolved",
      requestId: "r1",
      playerId: "p1",
      result: { raw: 2, bonus: 0, total: 2, dc: 10, outcome: "fail" },
    });
    expect(s.phase).toBe("awaitingRoll");
  });

  it("hp reaching 0 knocks the character out — never dead", () => {
    let s = baseState();
    s = applyEvent(s, { kind: "hp-changed", playerId: "p1", hp: 0, delta: -6 });
    expect(s.characters.p1?.status).toBe("knockedOut");

    s = applyEvent(s, { kind: "character-status", playerId: "p1", status: "rescued" });
    expect(s.characters.p1?.status).toBe("rescued");
  });

  it("awards items immutably", () => {
    const s0 = baseState();
    const s1 = applyEvent(s0, {
      kind: "item-awarded",
      playerId: "p1",
      item: { name: "Glow Compass", emoji: "🧭", description: "Points at friends" },
    });
    expect(s1.characters.p1?.items).toHaveLength(1);
    expect(s0.characters.p1?.items).toHaveLength(0);
  });

  it("ignores events for unknown players", () => {
    const s = baseState();
    expect(applyEvent(s, { kind: "hp-changed", playerId: "ghost", hp: 3, delta: -3 })).toBe(s);
  });
});
