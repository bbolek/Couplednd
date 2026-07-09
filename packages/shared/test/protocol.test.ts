import { describe, expect, it } from "vitest";
import { parseClientMessage, parseServerMessage } from "../src/protocol.js";

describe("parseClientMessage", () => {
  it("parses a valid join", () => {
    const msg = parseClientMessage(JSON.stringify({ type: "join", gameId: "g1", name: "Ayşe" }));
    expect(msg).toEqual({ type: "join", gameId: "g1", name: "Ayşe" });
  });

  it("parses a reconnect join with token", () => {
    const msg = parseClientMessage(
      JSON.stringify({ type: "join", gameId: "g1", playerToken: "tok" }),
    );
    expect(msg?.type).toBe("join");
  });

  it("parses character:create with full stats and avatar", () => {
    const msg = parseClientMessage(
      JSON.stringify({
        type: "character:create",
        name: "Nova",
        species: "Heeler Padawan",
        avatar: { emoji: "🐶", color: "sky", accessory: "✨" },
        stats: { brave: 3, smart: 2, charm: 2, sneaky: 1 },
      }),
    );
    expect(msg?.type).toBe("character:create");
  });

  it("rejects stats out of range at the schema layer", () => {
    const msg = parseClientMessage(
      JSON.stringify({
        type: "character:create",
        name: "Nova",
        species: "Robot",
        avatar: { emoji: "🤖", color: "mint" },
        stats: { brave: 9, smart: 0, charm: 0, sneaky: 0 },
      }),
    );
    expect(msg).toBeNull();
  });

  it("rejects malformed JSON, unknown types, and non-objects", () => {
    expect(parseClientMessage("not json")).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "hack:me" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify(42))).toBeNull();
  });

  it("rejects oversized free text", () => {
    const msg = parseClientMessage(
      JSON.stringify({ type: "action:submit", freeText: "x".repeat(500) }),
    );
    expect(msg).toBeNull();
  });
});

describe("parseServerMessage", () => {
  it("round-trips a pong", () => {
    expect(parseServerMessage(JSON.stringify({ type: "pong" }))).toEqual({ type: "pong" });
  });

  it("returns null on garbage", () => {
    expect(parseServerMessage("{{{")).toBeNull();
    expect(parseServerMessage("null")).toBeNull();
  });
});
