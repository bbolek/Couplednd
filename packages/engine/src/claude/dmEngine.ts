import Anthropic from "@anthropic-ai/sdk";
import type {
  Audience,
  Character,
  CharacterConcept,
  Language,
  PlayerId,
  WorldBible,
} from "@familyquest/shared";
import { isValidAllocation } from "@familyquest/shared";
import { DMError, type AttributedAction, type DMActions, type DMEngine } from "../dmTypes.js";
import { conceptsPrompt, dmCharter, rosterBlock, worldBibleBlock, worldGenPrompt } from "./prompts.js";
import { CONCEPTS_SCHEMA, DM_TOOLS, WORLD_BIBLE_SCHEMA } from "./tools.js";

export type DMModel = "claude-opus-4-8" | "claude-sonnet-5" | "claude-haiku-4-5";

export const DM_MODELS: { id: DMModel; labelKey: string; pricing: string }[] = [
  { id: "claude-opus-4-8", labelKey: "settings.modelBest", pricing: "$5 / $25 per MTok" },
  { id: "claude-sonnet-5", labelKey: "settings.modelBalanced", pricing: "$3 / $15 per MTok" },
  { id: "claude-haiku-4-5", labelKey: "settings.modelFast", pricing: "$1 / $5 per MTok" },
];

export interface ClaudeDMConfig {
  apiKey: string;
  model: DMModel;
  language: Language;
  /** Who's at the table — steers tone from bedtime-gentle to date-night witty. */
  audience: Audience;
  /** Roster snapshot, read when the adventure starts. */
  getParty: () => { playerId: PlayerId; playerName: string; character: Character }[];
  /**
   * Streaming-capable fetch. React Native's built-in fetch cannot stream —
   * the host app passes `fetch` from `expo/fetch`; Node callers omit it.
   */
  fetch?: typeof globalThis.fetch;
  onUsage?: (usage: UsageTotals) => void;
}

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

const NARRATION_MAX_TOKENS = 2048;
const SETUP_MAX_TOKENS = 4096;
const MAX_LOOP_ITERATIONS = 12;

/**
 * Per-model request params. Sampling params (temperature/top_p/top_k) are
 * rejected with a 400 on Opus 4.8 and Sonnet 5 — never send them. Thinking
 * is kept off for latency (a family DM turn should start in ~a second):
 * Opus 4.8 runs without thinking when the field is omitted; Sonnet 5
 * defaults to adaptive, so it needs an explicit disable. `effort` is
 * supported on Opus 4.8 / Sonnet 5 but errors on Haiku 4.5.
 */
export function buildModelParams(model: DMModel): {
  thinking?: { type: "disabled" };
  output_config?: { effort: "low" };
} {
  switch (model) {
    case "claude-opus-4-8":
      return { output_config: { effort: "low" } };
    case "claude-sonnet-5":
      return { thinking: { type: "disabled" }, output_config: { effort: "low" } };
    case "claude-haiku-4-5":
      return {};
  }
}

export function createClaudeDM(config: ClaudeDMConfig) {
  return (actions: DMActions): DMEngine => new ClaudeDM(actions, config);
}

class ClaudeDM implements DMEngine {
  private client: Anthropic;
  private world: WorldBible | null = null;
  private messages: Anthropic.MessageParam[] = [];
  /** Index into `messages` where the current scene began (for compaction). */
  private sceneStartIndex = 0;
  private messageNum = 0;
  private cancelled = false;
  private usage: UsageTotals = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };

  constructor(
    private readonly actions: DMActions,
    private readonly config: ClaudeDMConfig,
  ) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.fetch ? { fetch: config.fetch } : {}),
    });
  }

  // -------------------------------------------------------------------------
  // Setup calls (non-streaming, structured outputs)
  // -------------------------------------------------------------------------

  async generateWorld(shows: string[], language: Language): Promise<WorldBible> {
    const response = await this.request(() =>
      this.client.messages.create({
        model: this.config.model,
        max_tokens: SETUP_MAX_TOKENS,
        ...buildModelParams(this.config.model),
        output_config: {
          ...buildModelParams(this.config.model).output_config,
          format: { type: "json_schema", schema: WORLD_BIBLE_SCHEMA },
        },
        messages: [
          { role: "user", content: worldGenPrompt(shows, language, this.config.audience) },
        ],
      }),
    );
    this.recordUsage(response.usage);
    const world = JSON.parse(this.firstText(response)) as WorldBible;
    this.world = world;
    return world;
  }

  async generateConcepts(
    world: WorldBible,
    language: Language,
    count: number,
  ): Promise<CharacterConcept[]> {
    this.world = world;
    const response = await this.request(() =>
      this.client.messages.create({
        model: this.config.model,
        max_tokens: SETUP_MAX_TOKENS,
        ...buildModelParams(this.config.model),
        output_config: {
          ...buildModelParams(this.config.model).output_config,
          format: { type: "json_schema", schema: CONCEPTS_SCHEMA },
        },
        messages: [{ role: "user", content: conceptsPrompt(world, count, language) }],
      }),
    );
    this.recordUsage(response.usage);
    const parsed = JSON.parse(this.firstText(response)) as { concepts: CharacterConcept[] };
    // Guard the stat math — the schema can't express "sums to 8".
    return parsed.concepts.map((c) =>
      isValidAllocation(c.suggestedStats)
        ? c
        : { ...c, suggestedStats: { brave: 2, smart: 2, charm: 2, sneaky: 2 } },
    );
  }

  // -------------------------------------------------------------------------
  // The session loop
  // -------------------------------------------------------------------------

  async startAdventure(): Promise<void> {
    this.messages = [
      {
        role: "user",
        content:
          "Everyone is gathered, phones ready, snacks out. Begin the adventure: open the first scene and pull the party in!",
      },
    ];
    this.sceneStartIndex = 0;
    await this.turnLoop();
  }

  async playerAction(action: AttributedAction): Promise<void> {
    this.pushUser(`[${action.playerName} playing ${action.characterName}]: ${action.text}`);
    await this.turnLoop();
  }

  async nudge(instruction: string): Promise<void> {
    this.pushUser(`[Host, quietly, out-of-story]: ${instruction}`);
    await this.turnLoop();
  }

  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Manual agentic loop — the SDK tool-runner can't help here because
   * request_dice_roll / assign_task resolve only when a human acts,
   * seconds or minutes later. The API is stateless, so parking is free.
   */
  private async turnLoop(): Promise<void> {
    for (let i = 0; i < MAX_LOOP_ITERATIONS && !this.cancelled; i++) {
      const stream = this.client.messages.stream({
        model: this.config.model,
        max_tokens: NARRATION_MAX_TOKENS,
        ...buildModelParams(this.config.model),
        system: this.buildSystem(),
        tools: DM_TOOLS,
        messages: this.withCacheMarker(this.messages),
      });

      const messageId = `dm_m${++this.messageNum}`;
      let sawText = false;
      stream.on("text", (delta) => {
        if (this.cancelled) return;
        sawText = true;
        this.actions.narrationChunk(messageId, delta);
      });

      let message: Anthropic.Message;
      try {
        message = await stream.finalMessage();
      } catch (err) {
        if (sawText) this.actions.narrationDone(messageId);
        throw this.classify(err);
      }
      if (sawText) this.actions.narrationDone(messageId);
      this.recordUsage(message.usage);

      if (message.stop_reason === "refusal") {
        throw new DMError("refusal", "The model declined this beat.");
      }

      this.messages.push({ role: "assistant", content: message.content });

      if (message.stop_reason !== "tool_use") return; // end_turn — wait for players

      const toolUses = message.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      // Execute all tool calls (async human-in-the-loop ones park here),
      // then answer them ALL in a single user message.
      const results = await Promise.all(
        toolUses.map(async (block) => ({
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: await this.executeTool(block),
        })),
      );
      if (this.cancelled) return;
      this.messages.push({ role: "user", content: results });
    }
  }

  private async executeTool(block: Anthropic.ToolUseBlock): Promise<string> {
    const input = block.input as Record<string, unknown>;
    switch (block.name) {
      case "set_scene": {
        // A new scene: compact everything before this turn first.
        this.actions.setScene({
          title: String(input.title),
          summary: String(input.summary),
          imagePrompt: String(input.imagePrompt),
        });
        return "Scene is set and shown to everyone.";
      }
      case "request_dice_roll": {
        const result = await this.actions.requestDiceRoll({
          playerId: String(input.playerId),
          stat: input.stat as "brave" | "smart" | "charm" | "sneaky",
          dc: Number(input.dc),
          reason: String(input.reason),
        });
        return `They rolled ${result.raw} + ${result.bonus} (${String(input.stat)}) = ${result.total} vs DC ${result.dc}: ${result.outcome}.`;
      }
      case "assign_task": {
        const rawChoices = input.choices as { id: string; label: string }[] | null;
        const answer = await this.actions.assignTask({
          playerId: String(input.playerId),
          prompt: String(input.prompt),
          ...(rawChoices && rawChoices.length > 0 ? { choices: rawChoices } : {}),
        });
        return `Their answer: "${answer}"`;
      }
      case "award_item":
        this.actions.awardItem(String(input.playerId), {
          name: String(input.itemName),
          emoji: String(input.emoji),
          description: String(input.description),
        });
        return "Item delivered with sparkles.";
      case "update_hp":
        this.actions.updateHp(String(input.playerId), Number(input.delta), String(input.reason));
        return "Hearts updated.";
      case "set_character_status":
        this.actions.setCharacterStatus(
          String(input.playerId),
          input.status as "ok" | "knockedOut" | "rescued",
        );
        return "Status updated.";
      case "end_scene": {
        const summary = String(input.summary);
        this.actions.endScene(summary);
        this.compactScene(summary);
        return "Scene closed. The recap replaced the scene transcript — continue the story.";
      }
      case "end_adventure":
        this.actions.endAdventure(String(input.epilogue));
        return "The adventure is complete. Thank you, Dungeon Master.";
      default:
        return `Unknown tool ${block.name} — ignore and continue.`;
    }
  }

  /**
   * History compaction: replace the finished scene's messages with one
   * compact recap. Works identically on all three models and keeps the
   * prompt short and cache-friendly (we control the bytes exactly).
   */
  private compactScene(summary: string): void {
    const kept = this.messages.slice(0, this.sceneStartIndex);
    this.messages = [...kept, { role: "user", content: `[Scene recap] ${summary}` }];
    this.sceneStartIndex = this.messages.length;
  }

  // -------------------------------------------------------------------------
  // Prompt plumbing
  // -------------------------------------------------------------------------

  private buildSystem(): Anthropic.TextBlockParam[] {
    if (!this.world) throw new DMError("unknown", "World not generated yet.");
    const party = this.config.getParty();
    return [
      { type: "text", text: dmCharter(this.config.language, this.config.audience) },
      { type: "text", text: worldBibleBlock(this.world) },
      {
        type: "text",
        text: rosterBlock(party),
        // Caches tools + charter + world + roster as one stable prefix.
        cache_control: { type: "ephemeral" },
      },
    ];
  }

  /** Add an incremental cache breakpoint on the last message block. */
  private withCacheMarker(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
    if (messages.length === 0) return messages;
    const last = messages[messages.length - 1]!;
    if (typeof last.content === "string") {
      return [
        ...messages.slice(0, -1),
        {
          role: last.role,
          content: [
            { type: "text", text: last.content, cache_control: { type: "ephemeral" } },
          ],
        },
      ];
    }
    const blocks = last.content;
    const lastBlock = blocks[blocks.length - 1];
    if (!lastBlock || lastBlock.type !== "tool_result") return messages;
    return [
      ...messages.slice(0, -1),
      {
        role: last.role,
        content: [
          ...blocks.slice(0, -1),
          { ...lastBlock, cache_control: { type: "ephemeral" } },
        ],
      },
    ];
  }

  private pushUser(text: string): void {
    this.messages.push({ role: "user", content: text });
  }

  private firstText(message: Anthropic.Message): string {
    const block = message.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    if (!block) throw new DMError("unknown", "Model returned no text.");
    return block.text;
  }

  private recordUsage(usage: Anthropic.Usage): void {
    this.usage.inputTokens += usage.input_tokens;
    this.usage.outputTokens += usage.output_tokens;
    this.usage.cacheReadTokens += usage.cache_read_input_tokens ?? 0;
    this.usage.cacheWriteTokens += usage.cache_creation_input_tokens ?? 0;
    this.config.onUsage?.({ ...this.usage });
  }

  private async request<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw this.classify(err);
    }
  }

  private classify(err: unknown): Error {
    if (err instanceof DMError) return err;
    if (err instanceof Anthropic.AuthenticationError) {
      return new DMError("badKey", "The API key was rejected.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      return new DMError("rateLimited", "Rate limited — try again shortly.");
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return new DMError("network", "Could not reach the Claude API.");
    }
    return err instanceof Error ? err : new DMError("unknown", String(err));
  }
}
