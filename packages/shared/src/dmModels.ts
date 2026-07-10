/**
 * DM model catalog and usage accounting, shared between the game server
 * (which actually calls Claude) and the host app (which only picks a model
 * and displays cost) — the app never needs the Anthropic SDK.
 */

export type DMModel = "claude-opus-4-8" | "claude-sonnet-5" | "claude-haiku-4-5";

export const DM_MODELS: { id: DMModel; labelKey: string; pricing: string }[] = [
  { id: "claude-opus-4-8", labelKey: "settings.modelBest", pricing: "$5 / $25 per MTok" },
  { id: "claude-sonnet-5", labelKey: "settings.modelBalanced", pricing: "$3 / $15 per MTok" },
  { id: "claude-haiku-4-5", labelKey: "settings.modelFast", pricing: "$1 / $5 per MTok" },
];

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** Friendly errors the session surfaces to the host UI. */
export type DMErrorKind = "refusal" | "rateLimited" | "badKey" | "network" | "unknown";
