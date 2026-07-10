/**
 * Build-time configuration. The game server address is baked into the app
 * when it's built — families never see or type an IP:
 *
 *   EXPO_PUBLIC_FQ_SERVER=203.0.113.7 npx expo run:android
 *
 * (or put EXPO_PUBLIC_FQ_SERVER in apps/host/.env — Expo loads it
 * automatically). babel-preset-expo inlines EXPO_PUBLIC_* at bundle time.
 */

declare const process: { env: Record<string, string | undefined> };

/** "http://1.2.3.4:8787/" → "1.2.3.4:8787" */
export function normalizeServerAddress(input: string): string {
  return input
    .trim()
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/\/+$/, "");
}

const raw = process.env.EXPO_PUBLIC_FQ_SERVER;

/** Game server address (bare IP or host[:port]); null when the build has none. */
export const SERVER_ADDRESS: string | null = raw ? normalizeServerAddress(raw) : null;
