import { z } from "zod";
import { avatarSchema, statsSchema } from "./protocol.js";
import type { GameState, PlayerId } from "./gameState.js";
import type { DMErrorKind, DMModel, UsageTotals } from "./dmModels.js";

/**
 * Host-control wire protocol: the host app ↔ the game server, JSON text
 * frames on the `/host` WebSocket. Mirrors protocol.ts — host → server is
 * zod-validated (the server trusts nobody), server → host is plain TS.
 *
 * The first message on a connection must be `host:create` or `host:reattach`
 * and must carry the shared passcode (`hostKey`); everything else is only
 * accepted once a game is bound to the connection.
 */

// ---------------------------------------------------------------------------
// Host app → Server
// ---------------------------------------------------------------------------

export const hostCreateMessage = z.object({
  type: z.literal("host:create"),
  hostKey: z.string().min(1).max(128),
  shows: z.array(z.string().trim().min(1).max(60)).min(1).max(8),
  audience: z.enum(["kids", "family", "grownups"]),
  language: z.enum(["en", "tr"]),
  model: z.enum(["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"]),
});

export const hostReattachMessage = z.object({
  type: z.literal("host:reattach"),
  hostKey: z.string().min(1).max(128),
  gameId: z.string().min(1).max(64),
  hostToken: z.string().min(1).max(128),
});

export const hostCharacterMessage = z.object({
  type: z.literal("host:character"),
  name: z.string().trim().min(1).max(24),
  species: z.string().trim().min(1).max(40),
  avatar: avatarSchema,
  stats: statsSchema,
});

export const hostStartMessage = z.object({ type: z.literal("host:start") });

export const hostNudgeMessage = z.object({
  type: z.literal("host:nudge"),
  instruction: z.string().trim().min(1).max(280).optional(),
});

export const hostEndMessage = z.object({ type: z.literal("host:end") });

export const hostPingMessage = z.object({ type: z.literal("ping") });

export const hostClientMessageSchema = z.discriminatedUnion("type", [
  hostCreateMessage,
  hostReattachMessage,
  hostCharacterMessage,
  hostStartMessage,
  hostNudgeMessage,
  hostEndMessage,
  hostPingMessage,
]);

export type HostClientMessage = z.infer<typeof hostClientMessageSchema>;

/** Parse an incoming text frame from a host app. Returns null on any invalid input. */
export function parseHostClientMessage(raw: string): HostClientMessage | null {
  try {
    const result = hostClientMessageSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Server → Host app
// ---------------------------------------------------------------------------

export type HostServerErrorCode =
  | "BAD_HOST_KEY"
  | "GAME_NOT_FOUND"
  | "BAD_TOKEN"
  | "SERVER_FULL"
  | "NO_GAME"
  | "INVALID_MESSAGE";

export type HostServerMessage =
  | { type: "host:created"; gameId: string; joinUrl: string; hostToken: string }
  | { type: "host:reattached"; gameId: string; joinUrl: string; hostPlayerId: PlayerId | null }
  | { type: "host:player"; playerId: PlayerId }
  | { type: "state"; state: GameState }
  | { type: "narration"; messageId: string; text: string; done: boolean }
  | { type: "usage"; totals: UsageTotals }
  | { type: "dmError"; kind: DMErrorKind }
  | { type: "error"; code: HostServerErrorCode; message: string }
  | { type: "pong" };

export function serializeHostServerMessage(msg: HostServerMessage): string {
  return JSON.stringify(msg);
}

/** Used by the host app; trusts server output but guards JSON errors. */
export function parseHostServerMessage(raw: string): HostServerMessage | null {
  try {
    const parsed = JSON.parse(raw) as HostServerMessage;
    return typeof parsed === "object" && parsed !== null && "type" in parsed ? parsed : null;
  } catch {
    return null;
  }
}

/** The model shared by host + player traffic: everything on one origin. */
export function buildJoinUrl(origin: string, gameId: string): string {
  return `${origin}/join?g=${encodeURIComponent(gameId)}`;
}
