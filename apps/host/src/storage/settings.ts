import * as SecureStore from "expo-secure-store";
import type { DMModel, Language } from "@familyquest/shared";

/**
 * All settings live in the phone's secure keychain — the server passcode
 * must never touch AsyncStorage, and the rest is small enough to keep
 * alongside it. The Claude API key lives on the game server, never here.
 */

const KEY_SERVER = "fq.server";
const KEY_HOSTKEY = "fq.hostKey";
const KEY_MODEL = "fq.model";
const KEY_LANGUAGE = "fq.language";

export interface Settings {
  /** Game server address — bare IP or host[:port], no scheme. */
  serverAddress: string | null;
  /** Passcode the server requires to create games. */
  hostKey: string | null;
  model: DMModel;
  language: Language;
}

/** "http://1.2.3.4:8787/" → "1.2.3.4:8787" */
export function normalizeServerAddress(input: string): string {
  return input
    .trim()
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/\/+$/, "");
}

export async function loadSettings(): Promise<Settings> {
  const [serverAddress, hostKey, model, language] = await Promise.all([
    SecureStore.getItemAsync(KEY_SERVER),
    SecureStore.getItemAsync(KEY_HOSTKEY),
    SecureStore.getItemAsync(KEY_MODEL),
    SecureStore.getItemAsync(KEY_LANGUAGE),
  ]);
  return {
    serverAddress,
    hostKey,
    model: (model as DMModel | null) ?? "claude-opus-4-8",
    language: (language as Language | null) ?? "en",
  };
}

export async function saveServerAddress(address: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_SERVER, normalizeServerAddress(address));
}

export async function saveHostKey(hostKey: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_HOSTKEY, hostKey.trim());
}

export async function saveModel(model: DMModel): Promise<void> {
  await SecureStore.setItemAsync(KEY_MODEL, model);
}

export async function saveLanguage(language: Language): Promise<void> {
  await SecureStore.setItemAsync(KEY_LANGUAGE, language);
}
