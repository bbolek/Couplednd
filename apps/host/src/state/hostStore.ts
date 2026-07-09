import { create } from "zustand";
import { fetch as expoFetch } from "expo/fetch";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import type { Audience, Avatar, GameState, Language, Stats } from "@familyquest/shared";
import {
  createClaudeDM,
  DMError,
  GameSession,
  testApiKey,
  type DMModel,
  type UsageTotals,
} from "@familyquest/engine";
import type { RunningServer } from "@familyquest/server-core";
import { loadSettings, saveApiKey, saveLanguage, saveModel } from "../storage/settings";
import { startHostServer } from "../server/hostServer";
import i18n from "../i18n";

export type Screen =
  | "home"
  | "settings"
  | "newGame"
  | "lobby"
  | "hostCharacter"
  | "table"
  | "recap";

export interface NarrationBeat {
  messageId: string;
  text: string;
  done: boolean;
}

/** A streaming-capable fetch for the Anthropic SDK — RN's built-in can't stream. */
const streamingFetch = expoFetch as unknown as typeof globalThis.fetch;

interface HostStore {
  // Settings
  settingsLoaded: boolean;
  apiKey: string | null;
  model: DMModel;
  language: Language;
  keyStatus: "unknown" | "testing" | "ok" | "bad" | "network";

  // Navigation
  screen: Screen;

  // Active game
  session: GameSession | null;
  server: RunningServer | null;
  gameState: GameState | null;
  joinUrl: string | null;
  hostPlayerId: string | null;
  beats: NarrationBeat[];
  usage: UsageTotals | null;
  dmError: string | null;
  building: boolean;

  init(): Promise<void>;
  go(screen: Screen): void;
  setApiKey(key: string): Promise<void>;
  setModel(model: DMModel): Promise<void>;
  setLanguage(language: Language): Promise<void>;
  testKey(): Promise<void>;
  startNewGame(shows: string[], audience: Audience): Promise<void>;
  createHostCharacter(draft: {
    name: string;
    species: string;
    avatar: Avatar;
    stats: Stats;
  }): void;
  startAdventure(): Promise<void>;
  nudge(): Promise<void>;
  clearDmError(): void;
  endGame(): Promise<void>;
}

const MAX_BEATS = 80;

export const useHostStore = create<HostStore>((set, get) => ({
  settingsLoaded: false,
  apiKey: null,
  model: "claude-opus-4-8",
  language: "en",
  keyStatus: "unknown",
  screen: "home",
  session: null,
  server: null,
  gameState: null,
  joinUrl: null,
  hostPlayerId: null,
  beats: [],
  usage: null,
  dmError: null,
  building: false,

  async init() {
    const settings = await loadSettings();
    await i18n.changeLanguage(settings.language);
    set({
      apiKey: settings.apiKey,
      model: settings.model,
      language: settings.language,
      settingsLoaded: true,
      keyStatus: settings.apiKey ? "unknown" : "bad",
    });
  },

  go: (screen) => set({ screen }),

  async setApiKey(key) {
    await saveApiKey(key.trim());
    set({ apiKey: key.trim(), keyStatus: "unknown" });
  },

  async setModel(model) {
    await saveModel(model);
    set({ model });
  },

  async setLanguage(language) {
    await saveLanguage(language);
    await i18n.changeLanguage(language);
    set({ language });
  },

  async testKey() {
    const { apiKey, model } = get();
    if (!apiKey) return;
    set({ keyStatus: "testing" });
    const result = await testApiKey(apiKey, model, streamingFetch);
    set({ keyStatus: result.ok ? "ok" : result.reason === "badKey" ? "bad" : "network" });
  },

  async startNewGame(shows, audience) {
    const { apiKey, model, language } = get();
    if (!apiKey) {
      set({ dmError: i18n.t("errors.noKey") });
      return;
    }
    set({ building: true, dmError: null, beats: [], usage: null });

    const gameId = Math.random().toString(36).slice(2, 8);

    const session: GameSession = new GameSession({
      gameId,
      language,
      shows,
      audience,
      onError: (err) => {
        const key =
          err instanceof DMError
            ? err.kind === "rateLimited"
              ? "errors.rateLimited"
              : err.kind === "badKey"
                ? "errors.noKey"
                : err.kind === "network"
                  ? "errors.network"
                  : "errors.dmConfused"
            : "errors.dmConfused";
        set({ dmError: i18n.t(key) });
      },
      onNarration: (messageId, text, done) => {
        set((state) => {
          const beats = [...state.beats];
          const existing = beats.find((b) => b.messageId === messageId);
          if (done) {
            return { beats: beats.map((b) => (b.messageId === messageId ? { ...b, done: true } : b)) };
          }
          if (existing) existing.text += text;
          else {
            beats.push({ messageId, text, done: false });
            if (beats.length > MAX_BEATS) beats.shift();
          }
          return { beats };
        });
      },
      createDM: createClaudeDM({
        apiKey,
        model,
        language,
        audience,
        fetch: streamingFetch,
        getParty: () =>
          Object.entries(session.getState().characters).map(([playerId, character]) => ({
            playerId,
            playerName: session.getState().players[playerId]?.name ?? "?",
            character,
          })),
        onUsage: (usage) => set({ usage }),
      }),
    });

    session.subscribe((gameState) => set({ gameState }));

    try {
      const { server, joinUrl } = await startHostServer(session);
      await activateKeepAwakeAsync("familyquest-game");
      set({ session, server, joinUrl, gameState: session.getState() });
      await session.prepareWorld();
      set({ building: false, screen: "lobby" });
    } catch (err) {
      session.close();
      set({
        building: false,
        session: null,
        server: null,
        dmError: err instanceof DMError ? i18n.t("errors.dmConfused") : String(err),
      });
    }
  },

  createHostCharacter(draft) {
    const { session, language } = get();
    if (!session) return;
    let hostPlayerId = get().hostPlayerId;
    if (!hostPlayerId) {
      hostPlayerId = session.addHostPlayer(language === "tr" ? "Ev sahibi" : "Host");
      set({ hostPlayerId });
    }
    session.createCharacterFor(hostPlayerId, draft);
    set({ screen: "lobby" });
  },

  async startAdventure() {
    const { session } = get();
    if (!session) return;
    set({ screen: "table" });
    await session.startAdventure();
  },

  async nudge() {
    await get().session?.nudge("Please move the story along to something new and engaging.");
  },

  clearDmError: () => set({ dmError: null }),

  async endGame() {
    const { session, server } = get();
    session?.close();
    await server?.close().catch(() => undefined);
    deactivateKeepAwake("familyquest-game");
    set({
      session: null,
      server: null,
      gameState: null,
      joinUrl: null,
      hostPlayerId: null,
      beats: [],
      screen: "home",
    });
  },
}));
