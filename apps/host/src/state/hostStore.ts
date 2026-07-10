import { create } from "zustand";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import type {
  Audience,
  Avatar,
  DMErrorKind,
  DMModel,
  GameState,
  Language,
  Stats,
  UsageTotals,
} from "@familyquest/shared";
import {
  loadSettings,
  normalizeServerAddress,
  saveHostKey,
  saveLanguage,
  saveModel,
  saveServerAddress,
} from "../storage/settings";
import { RemoteGame } from "../server/remoteGame";
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

interface HostStore {
  // Settings
  settingsLoaded: boolean;
  serverAddress: string | null;
  hostKey: string | null;
  model: DMModel;
  language: Language;
  serverStatus: "unknown" | "testing" | "ok" | "unreachable";

  // Navigation
  screen: Screen;

  // Active game (lives on the server; this is the remote control)
  game: RemoteGame | null;
  gameState: GameState | null;
  joinUrl: string | null;
  hostPlayerId: string | null;
  beats: NarrationBeat[];
  usage: UsageTotals | null;
  dmError: string | null;
  building: boolean;

  init(): Promise<void>;
  go(screen: Screen): void;
  setServerAddress(address: string): Promise<void>;
  setHostKey(hostKey: string): Promise<void>;
  setModel(model: DMModel): Promise<void>;
  setLanguage(language: Language): Promise<void>;
  testServer(): Promise<void>;
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
const HEALTH_TIMEOUT_MS = 5000;

function dmErrorText(kind: DMErrorKind): string {
  const key =
    kind === "rateLimited"
      ? "errors.rateLimited"
      : kind === "network"
        ? "errors.network"
        : "errors.dmConfused";
  return i18n.t(key);
}

export const useHostStore = create<HostStore>((set, get) => ({
  settingsLoaded: false,
  serverAddress: null,
  hostKey: null,
  model: "claude-opus-4-8",
  language: "en",
  serverStatus: "unknown",
  screen: "home",
  game: null,
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
      serverAddress: settings.serverAddress,
      hostKey: settings.hostKey,
      model: settings.model,
      language: settings.language,
      settingsLoaded: true,
    });
  },

  go: (screen) => set({ screen }),

  async setServerAddress(address) {
    const normalized = normalizeServerAddress(address);
    await saveServerAddress(normalized);
    set({ serverAddress: normalized, serverStatus: "unknown" });
  },

  async setHostKey(hostKey) {
    await saveHostKey(hostKey);
    set({ hostKey: hostKey.trim() });
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

  async testServer() {
    const { serverAddress } = get();
    if (!serverAddress) return;
    set({ serverStatus: "testing" });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      const res = await fetch(`http://${serverAddress}/health`, { signal: controller.signal });
      clearTimeout(timer);
      set({ serverStatus: res.ok ? "ok" : "unreachable" });
    } catch {
      set({ serverStatus: "unreachable" });
    }
  },

  async startNewGame(shows, audience) {
    const { serverAddress, hostKey, model, language } = get();
    if (!serverAddress || !hostKey) {
      set({ dmError: i18n.t("errors.noServer") });
      return;
    }
    set({ building: true, dmError: null, beats: [], usage: null });

    const resetToNewGame = (message: string): void => {
      get().game?.close();
      set({ building: false, game: null, joinUrl: null, gameState: null, dmError: message });
    };

    const game = new RemoteGame(serverAddress, hostKey, {
      onCreated: ({ joinUrl }) => {
        set({ joinUrl });
        void activateKeepAwakeAsync("familyquest-game");
      },
      onState: (gameState) => {
        set({ gameState });
        // World + concepts ready = lobby time (parity with the old local flow).
        if (get().building && gameState.setup.concepts.length > 0) {
          set({ building: false, screen: "lobby" });
        }
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
      onUsage: (usage) => set({ usage }),
      onDmError: (kind) => {
        if (get().building) resetToNewGame(dmErrorText(kind));
        else set({ dmError: dmErrorText(kind) });
      },
      onHostPlayer: (hostPlayerId) => set({ hostPlayerId, screen: "lobby" }),
      onServerError: (code) => {
        const message =
          code === "BAD_HOST_KEY" || code === "SERVER_FULL" || code === "GAME_NOT_FOUND"
            ? i18n.t("settings.serverFailed")
            : i18n.t("errors.dmConfused");
        resetToNewGame(message);
      },
      onConnectionLost: () => set({ dmError: i18n.t("errors.serverLost") }),
      onConnectionRestored: () => set({ dmError: null }),
      onFailed: () => resetToNewGame(i18n.t("errors.network")),
    });

    set({ game });
    game.start({ shows, audience, language, model });
  },

  createHostCharacter(draft) {
    // hostPlayerId + screen change arrive via the host:player message.
    get().game?.createCharacter(draft);
  },

  async startAdventure() {
    const { game } = get();
    if (!game) return;
    set({ screen: "table" });
    game.startAdventure();
  },

  async nudge() {
    get().game?.nudge();
  },

  clearDmError: () => set({ dmError: null }),

  async endGame() {
    get().game?.end();
    deactivateKeepAwake("familyquest-game");
    set({
      game: null,
      gameState: null,
      joinUrl: null,
      hostPlayerId: null,
      beats: [],
      screen: "home",
    });
  },
}));
