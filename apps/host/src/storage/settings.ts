import * as SecureStore from "expo-secure-store";
import type { Language } from "@familyquest/shared";
import type { DMModel } from "@familyquest/engine";

/**
 * All settings live in the phone's secure keychain — the API key must never
 * touch AsyncStorage, and the rest is small enough to keep alongside it.
 */

const KEY_API = "fq.apiKey";
const KEY_MODEL = "fq.model";
const KEY_LANGUAGE = "fq.language";

export interface Settings {
  apiKey: string | null;
  model: DMModel;
  language: Language;
}

export async function loadSettings(): Promise<Settings> {
  const [apiKey, model, language] = await Promise.all([
    SecureStore.getItemAsync(KEY_API),
    SecureStore.getItemAsync(KEY_MODEL),
    SecureStore.getItemAsync(KEY_LANGUAGE),
  ]);
  return {
    apiKey,
    model: (model as DMModel | null) ?? "claude-opus-4-8",
    language: (language as Language | null) ?? "en",
  };
}

export async function saveApiKey(apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_API, apiKey);
}

export async function saveModel(model: DMModel): Promise<void> {
  await SecureStore.setItemAsync(KEY_MODEL, model);
}

export async function saveLanguage(language: Language): Promise<void> {
  await SecureStore.setItemAsync(KEY_LANGUAGE, language);
}
