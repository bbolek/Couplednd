import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PORT } from "@familyquest/shared";

export interface ServerConfig {
  port: number;
  /** Shared passcode host apps must present to create/reattach games. */
  hostKey: string;
  /** null only when mockDM is on. */
  anthropicApiKey: string | null;
  /** FQ_MOCK_DM=1 — scripted DM, zero API spend (local testing). */
  mockDM: boolean;
  maxGames: number;
  /** Games with no activity for this long are closed. */
  gameTtlMs: number;
  /** Overrides the Host header when building join URLs (e.g. "http://203.0.113.7"). */
  publicOrigin: string | null;
  /** Directory holding the built player SPA. */
  playerDistDir: string;
}

const here = dirname(fileURLToPath(import.meta.url));

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const mockDM = env.FQ_MOCK_DM === "1";
  const anthropicApiKey = env.ANTHROPIC_API_KEY || null;
  const hostKey = env.FQ_HOST_KEY || "";

  if (!hostKey) {
    throw new Error("FQ_HOST_KEY is required — the passcode host apps use to create games.");
  }
  if (!mockDM && !anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required (or set FQ_MOCK_DM=1 for the scripted DM).");
  }

  return {
    port: Number(env.PORT ?? DEFAULT_PORT),
    hostKey,
    anthropicApiKey,
    mockDM,
    maxGames: Number(env.FQ_MAX_GAMES ?? 20),
    gameTtlMs: Number(env.FQ_GAME_TTL_MS ?? 3 * 60 * 60 * 1000),
    publicOrigin: env.PUBLIC_ORIGIN?.replace(/\/+$/, "") || null,
    playerDistDir: env.FQ_PLAYER_DIST ?? resolve(here, "../../player/dist"),
  };
}
