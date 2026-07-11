import { z } from "zod";
import { STATS, STAT_MAX, STAT_MIN } from "./rules.js";
import type { GameState } from "./gameState.js";
import type { GameEvent } from "./events.js";

/**
 * WebSocket wire protocol. All frames are JSON text.
 *
 * Client → Host messages are zod-validated (browsers are untrusted input).
 * Host → Client messages are plain TS types (the host is the authority).
 */

// ---------------------------------------------------------------------------
// Client → Host
// ---------------------------------------------------------------------------

export const statsSchema = z.object(
  Object.fromEntries(
    STATS.map((s) => [s, z.number().int().min(STAT_MIN).max(STAT_MAX)]),
  ) as Record<(typeof STATS)[number], z.ZodNumber>,
);

const spriteToken = z.string().max(32);

export const avatarSpriteSchema = z.object({
  skinColor: spriteToken,
  top: spriteToken,
  hairColor: spriteToken,
  hatColor: spriteToken,
  clothing: spriteToken,
  clothesColor: spriteToken,
  eyes: spriteToken,
  mouth: spriteToken,
  accessory: spriteToken,
  facialHair: spriteToken,
});

export const avatarSchema = z.object({
  emoji: z.string().min(1).max(8),
  color: z.string().min(1).max(24),
  accessory: z.string().min(1).max(8).optional(),
  sprite: avatarSpriteSchema.optional(),
});

export const joinMessage = z.object({
  type: z.literal("join"),
  gameId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(24).optional(),
  playerToken: z.string().min(1).max(128).optional(),
});

export const characterCreateMessage = z.object({
  type: z.literal("character:create"),
  name: z.string().trim().min(1).max(24),
  species: z.string().trim().min(1).max(40),
  conceptId: z.string().max(64).optional(),
  avatar: avatarSchema,
  stats: statsSchema,
});

export const actionSubmitMessage = z.object({
  type: z.literal("action:submit"),
  taskId: z.string().max(64).optional(),
  choiceId: z.string().max(64).optional(),
  freeText: z.string().trim().max(280).optional(),
});

export const diceRollMessage = z.object({
  type: z.literal("dice:roll"),
  requestId: z.string().min(1).max(64),
});

export const pingMessage = z.object({ type: z.literal("ping") });

export const clientMessageSchema = z.discriminatedUnion("type", [
  joinMessage,
  characterCreateMessage,
  actionSubmitMessage,
  diceRollMessage,
  pingMessage,
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

/** Parse an incoming text frame from a player. Returns null on any invalid input. */
export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const result = clientMessageSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Host → Client
// ---------------------------------------------------------------------------

export type ServerErrorCode =
  | "GAME_FULL"
  | "GAME_NOT_FOUND"
  | "BAD_TOKEN"
  | "INVALID_MESSAGE"
  | "NOT_YOUR_TURN"
  | "ALREADY_HAS_CHARACTER";

export type ServerMessage =
  | {
      type: "joined";
      playerId: string;
      playerToken: string;
      /** seq of the snapshot that immediately follows */
      snapshotSeq: number;
    }
  | { type: "state:snapshot"; seq: number; state: GameState }
  | { type: "event"; seq: number; event: GameEvent }
  | { type: "error"; code: ServerErrorCode; message: string }
  | { type: "pong" };

export function serializeServerMessage(msg: ServerMessage): string {
  return JSON.stringify(msg);
}

/** Used by clients (player SPA / tests); trusts host output but guards JSON errors. */
export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const parsed = JSON.parse(raw) as ServerMessage;
    return typeof parsed === "object" && parsed !== null && "type" in parsed ? parsed : null;
  } catch {
    return null;
  }
}

export const MAX_PLAYERS = 7;
export const DEFAULT_PORT = 8787;
