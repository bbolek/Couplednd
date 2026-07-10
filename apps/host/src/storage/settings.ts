import * as SecureStore from "expo-secure-store";
import type { DMModel, Language } from "@familyquest/shared";

/**
 * All settings live in the phone's secure keychain — the server passcode
 * must never touch AsyncStorage, and the rest is small enough to keep
 * alongside it. The Claude API key lives on the game server, and the server
 * address is baked into the build (src/config.ts) — neither is stored here.
 */

const KEY_HOSTKEY = "fq.hostKey";
const KEY_MODEL = "fq.model";
const KEY_LANGUAGE = "fq.language";

export interface Settings {
  /** Passcode the server requires to create games. */
  hostKey: string | null;
  model: DMModel;
  language: Language;
}

export async function loadSettings(): Promise<Settings> {
  const [hostKey, model, language] = await Promise.all([
    SecureStore.getItemAsync(KEY_HOSTKEY),
    SecureStore.getItemAsync(KEY_MODEL),
    SecureStore.getItemAsync(KEY_LANGUAGE),
  ]);
  return {
    hostKey,
    model: (model as DMModel | null) ?? "claude-opus-4-8",
    language: (language as Language | null) ?? "en",
  };
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
