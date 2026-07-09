import Anthropic from "@anthropic-ai/sdk";
import type { DMModel } from "./claude/dmEngine.js";

/**
 * Cheap key validation for the Settings screen: count_tokens costs nothing
 * and fails fast with AuthenticationError on a bad key.
 */
export async function testApiKey(
  apiKey: string,
  model: DMModel,
  fetchImpl?: typeof globalThis.fetch,
): Promise<{ ok: true } | { ok: false; reason: "badKey" | "network" }> {
  const client = new Anthropic({ apiKey, ...(fetchImpl ? { fetch: fetchImpl } : {}) });
  try {
    await client.messages.countTokens({
      model,
      messages: [{ role: "user", content: "hi" }],
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, reason: "badKey" };
    return { ok: false, reason: "network" };
  }
}
