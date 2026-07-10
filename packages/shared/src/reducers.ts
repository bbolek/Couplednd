import type { GameState } from "./gameState.js";
import type { GameEvent } from "./events.js";

/**
 * Apply a broadcast GameEvent to a GameState. Pure — returns a new object.
 * Used by the host (as the authoritative mutation path), the player SPA
 * (to keep its snapshot fresh), and tests.
 */
export function applyEvent(state: GameState, event: GameEvent): GameState {
  switch (event.kind) {
    case "player-joined":
      return {
        ...state,
        players: { ...state.players, [event.player.playerId]: event.player },
      };

    case "player-connection": {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: { ...player, connection: event.connection },
        },
      };
    }

    case "character-created":
      return {
        ...state,
        characters: { ...state.characters, [event.playerId]: event.character },
      };

    case "concepts-ready":
      return { ...state, setup: { ...state.setup, concepts: event.concepts } };

    case "phase-changed":
      return { ...state, phase: event.phase };

    case "scene-changed":
      return { ...state, scene: event.scene };

    case "narration-chunk":
    case "narration-done":
      // Narration is rendered from the stream directly; the log entry is
      // appended by the host when the message completes.
      return state;

    case "dice-requested":
      return {
        ...state,
        phase: "awaitingRoll",
        pending: {
          ...state.pending,
          rolls: { ...state.pending.rolls, [event.request.requestId]: event.request },
        },
      };

    case "dice-resolved": {
      const { [event.requestId]: _resolved, ...rolls } = state.pending.rolls;
      const stillWaiting =
        Object.keys(rolls).length > 0 || Object.keys(state.pending.tasks).length > 0;
      return {
        ...state,
        phase: stillWaiting ? state.phase : "playing",
        pending: { ...state.pending, rolls },
      };
    }

    case "task-assigned":
      return {
        ...state,
        phase: "awaitingTask",
        pending: {
          ...state.pending,
          tasks: { ...state.pending.tasks, [event.task.taskId]: event.task },
        },
      };

    case "task-resolved": {
      const { [event.taskId]: _resolved, ...tasks } = state.pending.tasks;
      const stillWaiting =
        Object.keys(tasks).length > 0 || Object.keys(state.pending.rolls).length > 0;
      return {
        ...state,
        phase: stillWaiting ? state.phase : "playing",
        pending: { ...state.pending, tasks },
      };
    }

    case "item-awarded": {
      const character = state.characters[event.playerId];
      if (!character) return state;
      return {
        ...state,
        characters: {
          ...state.characters,
          [event.playerId]: { ...character, items: [...character.items, event.item] },
        },
      };
    }

    case "hp-changed": {
      const character = state.characters[event.playerId];
      if (!character) return state;
      return {
        ...state,
        characters: {
          ...state.characters,
          [event.playerId]: {
            ...character,
            hp: event.hp,
            status: event.hp === 0 ? "knockedOut" : character.status,
          },
        },
      };
    }

    case "character-status": {
      const character = state.characters[event.playerId];
      if (!character) return state;
      return {
        ...state,
        characters: {
          ...state.characters,
          [event.playerId]: { ...character, status: event.status },
        },
      };
    }

    case "game-ended":
      return { ...state, phase: "ended" };

    case "dm-error":
      // Transient signal for the UIs; the game state itself is unchanged.
      return state;
  }
}
