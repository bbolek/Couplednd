import type { Stats, RollResult, StatName } from "./rules.js";
import type { AvatarSprite } from "./avatarSprite.js";

export type Language = "en" | "tr";

/**
 * Who's at the table. Steers the DM's tone: bedtime-story gentle for kids,
 * balanced for mixed families, wittier and higher-stakes for adults
 * (date-night couples included — never gory, just not babyish).
 */
export type Audience = "kids" | "family" | "grownups";

export type GamePhase =
  | "lobby"
  | "characterCreation"
  | "playing"
  | "awaitingRoll"
  | "awaitingTask"
  | "paused"
  | "ended";

export type PlayerId = string;
export type RequestId = string;
export type TaskId = string;

export type CharacterStatus = "ok" | "knockedOut" | "rescued";

export interface Avatar {
  /** Emoji used as the character's face, e.g. "🦊". Fallback when no sprite. */
  emoji: string;
  /** Token from the avatar palette, resolved to a color by the theme. */
  color: string;
  /** Optional accessory emoji layered on the badge, e.g. "🎩". */
  accessory?: string;
  /** Customized sprite look (DiceBear avataaars); preferred over emoji when set. */
  sprite?: AvatarSprite;
}

export interface Item {
  name: string;
  emoji: string;
  description: string;
}

export interface Character {
  name: string;
  species: string;
  avatar: Avatar;
  stats: Stats;
  hp: number;
  maxHp: number;
  items: Item[];
  status: CharacterStatus;
}

export interface CharacterConcept {
  id: string;
  name: string;
  species: string;
  tagline: string;
  emoji: string;
  suggestedStats: Stats;
}

export interface WorldBible {
  title: string;
  setting: string;
  tone: string;
  locations: { name: string; description: string }[];
  npcs: { name: string; description: string }[];
  arc: { act: number; summary: string }[];
  partyHook: string;
}

export interface Scene {
  id: string;
  title: string;
  summary: string;
  imagePrompt?: string;
}

export interface DiceRequest {
  requestId: RequestId;
  playerId: PlayerId;
  stat: StatName;
  dc: number;
  reason: string;
  result?: RollResult;
}

export interface Task {
  taskId: TaskId;
  playerId: PlayerId;
  prompt: string;
  choices?: { id: string; label: string }[];
}

export interface PlayerInfo {
  playerId: PlayerId;
  name: string;
  connection: "online" | "offline";
  isHost: boolean;
}

export interface AdventureLogEntry {
  id: string;
  at: number;
  kind: "narration" | "dice" | "task" | "item" | "status" | "scene" | "system";
  text: string;
  playerId?: PlayerId;
}

export interface GameState {
  gameId: string;
  createdAt: number;
  language: Language;
  phase: GamePhase;
  setup: {
    shows: string[];
    audience: Audience;
    worldBible?: WorldBible;
    concepts: CharacterConcept[];
  };
  players: Record<PlayerId, PlayerInfo>;
  characters: Record<PlayerId, Character>;
  scene?: Scene;
  pending: {
    rolls: Record<RequestId, DiceRequest>;
    tasks: Record<TaskId, Task>;
  };
  log: AdventureLogEntry[];
}

export function createInitialGameState(
  gameId: string,
  language: Language,
  shows: string[],
  audience: Audience = "family",
  now: number = Date.now(),
): GameState {
  return {
    gameId,
    createdAt: now,
    language,
    phase: "lobby",
    setup: { shows, audience, concepts: [] },
    players: {},
    characters: {},
    pending: { rolls: {}, tasks: {} },
    log: [],
  };
}
