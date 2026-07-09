import { create } from "zustand";
import {
  applyEvent,
  type DiceRequest,
  type GameEvent,
  type GameState,
  type RollResult,
  type ServerErrorCode,
  type Task,
} from "@familyquest/shared";

export type ConnectionStatus = "connecting" | "online" | "reconnecting" | "failed";

export interface NarrationBeat {
  messageId: string;
  text: string;
  done: boolean;
}

interface PlayerStore {
  status: ConnectionStatus;
  playerId: string | null;
  error: ServerErrorCode | null;
  game: GameState | null;
  beats: NarrationBeat[];
  /** Dice request currently addressed to me (full-screen takeover). */
  myDiceRequest: DiceRequest | null;
  /** Result of my last roll, kept briefly for the celebration. */
  lastRoll: RollResult | null;
  /** Task currently addressed to me. */
  myTask: Task | null;

  setStatus(status: ConnectionStatus): void;
  setJoined(playerId: string): void;
  setError(error: ServerErrorCode | null): void;
  setSnapshot(state: GameState): void;
  applyGameEvent(event: GameEvent): void;
  clearLastRoll(): void;
}

const MAX_BEATS = 60;

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  status: "connecting",
  playerId: null,
  error: null,
  game: null,
  beats: [],
  myDiceRequest: null,
  lastRoll: null,
  myTask: null,

  setStatus: (status) => set({ status }),
  setJoined: (playerId) => set({ playerId, error: null }),
  setError: (error) => set({ error }),

  setSnapshot: (game) => {
    const me = get().playerId;
    const myDiceRequest =
      Object.values(game.pending.rolls).find((r) => r.playerId === me) ?? null;
    const myTask = Object.values(game.pending.tasks).find((t) => t.playerId === me) ?? null;
    set({ game, myDiceRequest, myTask });
  },

  applyGameEvent: (event) => {
    const { game, playerId } = get();
    if (!game) return;
    const next = applyEvent(game, event);
    const patch: Partial<PlayerStore> = { game: next };

    switch (event.kind) {
      case "narration-chunk": {
        const beats = [...get().beats];
        const existing = beats.find((b) => b.messageId === event.messageId);
        if (existing) {
          existing.text += event.text;
        } else {
          beats.push({ messageId: event.messageId, text: event.text, done: false });
          if (beats.length > MAX_BEATS) beats.shift();
        }
        patch.beats = beats;
        break;
      }
      case "narration-done": {
        patch.beats = get().beats.map((b) =>
          b.messageId === event.messageId ? { ...b, done: true } : b,
        );
        break;
      }
      case "dice-requested":
        if (event.request.playerId === playerId) patch.myDiceRequest = event.request;
        break;
      case "dice-resolved":
        if (event.playerId === playerId) {
          patch.myDiceRequest = null;
          patch.lastRoll = event.result;
        }
        break;
      case "task-assigned":
        if (event.task.playerId === playerId) patch.myTask = event.task;
        break;
      case "task-resolved":
        if (event.playerId === playerId) patch.myTask = null;
        break;
    }

    set(patch);
  },

  clearLastRoll: () => set({ lastRoll: null }),
}));
