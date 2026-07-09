import type {
  CharacterConcept,
  Item,
  Language,
  PlayerId,
  RollResult,
  Scene,
  StatName,
  WorldBible,
} from "@familyquest/shared";

/**
 * What a Dungeon Master engine can *do* to the game. The GameSession
 * implements this; both the Claude engine and the scripted mock drive it.
 *
 * `requestDiceRoll` and `assignTask` are the human-in-the-loop tools: the
 * returned promise parks the DM's agentic loop until a real person on a
 * real phone acts.
 */
export interface DMActions {
  narrationChunk(messageId: string, text: string): void;
  narrationDone(messageId: string): void;

  setScene(scene: Omit<Scene, "id">): void;
  requestDiceRoll(input: {
    playerId: PlayerId;
    stat: StatName;
    dc: number;
    reason: string;
  }): Promise<RollResult>;
  assignTask(input: {
    playerId: PlayerId;
    prompt: string;
    choices?: { id: string; label: string }[];
  }): Promise<string>;
  awardItem(playerId: PlayerId, item: Item): void;
  updateHp(playerId: PlayerId, delta: number, reason?: string): void;
  setCharacterStatus(playerId: PlayerId, status: "ok" | "knockedOut" | "rescued"): void;
  endScene(summary: string): void;
  endAdventure(epilogue: string): void;
}

/** A named player action forwarded to the DM. */
export interface AttributedAction {
  playerId: PlayerId;
  playerName: string;
  characterName: string;
  text: string;
}

export interface DMEngine {
  generateWorld(shows: string[], language: Language): Promise<WorldBible>;
  generateConcepts(
    world: WorldBible,
    language: Language,
    count: number,
  ): Promise<CharacterConcept[]>;

  /** Kick off the adventure. Resolves when the DM's first turn fully completes. */
  startAdventure(): Promise<void>;

  /** Free-text player action between beats. Resolves when the DM turn completes. */
  playerAction(action: AttributedAction): Promise<void>;

  /** Host steering ("nudge the story", "end the scene soon"). */
  nudge(instruction: string): Promise<void>;

  /** Abandon in-flight work (game paused or ended). */
  cancel(): void;
}

export type DMEngineFactory = (actions: DMActions) => DMEngine;

/** Friendly errors the session surfaces to the host UI. */
export type DMErrorKind = "refusal" | "rateLimited" | "badKey" | "network" | "unknown";

export class DMError extends Error {
  constructor(
    public readonly kind: DMErrorKind,
    message: string,
  ) {
    super(message);
  }
}
