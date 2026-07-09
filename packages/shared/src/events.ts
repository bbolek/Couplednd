import type {
  Character,
  CharacterConcept,
  CharacterStatus,
  DiceRequest,
  GamePhase,
  Item,
  PlayerId,
  PlayerInfo,
  RequestId,
  Scene,
  Task,
} from "./gameState.js";
import type { RollResult } from "./rules.js";

/**
 * Delta events broadcast from the host to every connected client.
 * Clients apply these on top of the last `state:snapshot`.
 */
export type GameEvent =
  | { kind: "player-joined"; player: PlayerInfo }
  | { kind: "player-connection"; playerId: PlayerId; connection: "online" | "offline" }
  | { kind: "character-created"; playerId: PlayerId; character: Character }
  | { kind: "concepts-ready"; concepts: CharacterConcept[] }
  | { kind: "phase-changed"; phase: GamePhase }
  | { kind: "scene-changed"; scene: Scene }
  | { kind: "narration-chunk"; messageId: string; text: string }
  | { kind: "narration-done"; messageId: string }
  | { kind: "dice-requested"; request: DiceRequest }
  | { kind: "dice-resolved"; requestId: RequestId; playerId: PlayerId; result: RollResult }
  | { kind: "task-assigned"; task: Task }
  | { kind: "task-resolved"; taskId: string; playerId: PlayerId; answer: string }
  | { kind: "item-awarded"; playerId: PlayerId; item: Item }
  | { kind: "hp-changed"; playerId: PlayerId; hp: number; delta: number; reason?: string }
  | { kind: "character-status"; playerId: PlayerId; status: CharacterStatus }
  | { kind: "game-ended"; epilogue: string };
