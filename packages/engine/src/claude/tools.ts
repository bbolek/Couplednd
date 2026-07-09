import type Anthropic from "@anthropic-ai/sdk";

/**
 * Tool definitions for the DM. All strict so tool inputs validate exactly —
 * mechanics must come out as structured events, never as prose.
 */

const STAT_ENUM = ["brave", "smart", "charm", "sneaky"];

function strictTool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
): Anthropic.Tool {
  return {
    name,
    description,
    strict: true,
    input_schema: {
      type: "object" as const,
      properties,
      required,
      additionalProperties: false,
    },
  } as Anthropic.Tool;
}

export const DM_TOOLS: Anthropic.Tool[] = [
  strictTool(
    "set_scene",
    "Open a new scene. Call this whenever the story moves to a new place or situation.",
    {
      title: { type: "string", description: "Short evocative scene title shown on every screen" },
      summary: { type: "string", description: "One sentence describing the scene" },
      imagePrompt: {
        type: "string",
        description: "A short storybook-illustration prompt for this scene",
      },
    },
    ["title", "summary", "imagePrompt"],
  ),
  strictTool(
    "request_dice_roll",
    "Ask ONE hero to roll the d20 for a challenge. The turn pauses until the player rolls on their phone. The result comes back as raw roll + talent bonus vs your difficulty.",
    {
      playerId: { type: "string", description: "The playerId of the hero who must roll" },
      stat: { type: "string", enum: STAT_ENUM, description: "Which talent applies" },
      dc: { type: "integer", enum: [5, 10, 15], description: "5 easy, 10 medium, 15 hard" },
      reason: {
        type: "string",
        description: "Short player-facing description of what they're attempting",
      },
    },
    ["playerId", "stat", "dc", "reason"],
  ),
  strictTool(
    "assign_task",
    "Ask ONE hero a direct question or give them a personal mini-task (what do you say / which path / invent something). The turn pauses until they answer on their phone.",
    {
      playerId: { type: "string" },
      prompt: { type: "string", description: "The question, addressed warmly to that hero" },
      choices: {
        type: ["array", "null"],
        description: "Optional 2-4 tappable choices; null for free-text answers",
        items: {
          type: "object",
          properties: { id: { type: "string" }, label: { type: "string" } },
          required: ["id", "label"],
          additionalProperties: false,
        },
      },
    },
    ["playerId", "prompt", "choices"],
  ),
  strictTool(
    "award_item",
    "Give a hero a fun item. Use sparingly — items should feel special.",
    {
      playerId: { type: "string" },
      itemName: { type: "string" },
      emoji: { type: "string", description: "One emoji representing the item" },
      description: { type: "string", description: "One playful sentence" },
    },
    ["playerId", "itemName", "emoji", "description"],
  ),
  strictTool(
    "update_hp",
    "Change a hero's heart points (negative = lose hearts, positive = recover). At 0 they are knocked out, never dead.",
    {
      playerId: { type: "string" },
      delta: { type: "integer", description: "-3 to +3 typically; keep stakes gentle" },
      reason: { type: "string", description: "Short player-facing reason" },
    },
    ["playerId", "delta", "reason"],
  ),
  strictTool(
    "set_character_status",
    "Mark a hero ok, knockedOut, or rescued. Use rescued when a friend saves them (a lovely moment — celebrate it).",
    {
      playerId: { type: "string" },
      status: { type: "string", enum: ["ok", "knockedOut", "rescued"] },
    },
    ["playerId", "status"],
  ),
  strictTool(
    "end_scene",
    "Close the current scene with a one-paragraph summary of what happened. Call after 3-5 beats.",
    { summary: { type: "string" } },
    ["summary"],
  ),
  strictTool(
    "end_adventure",
    "Finish the whole adventure with a warm epilogue that celebrates every hero by name.",
    { epilogue: { type: "string" } },
    ["epilogue"],
  ),
];

/** JSON schema for structured world generation. */
export const WORLD_BIBLE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    setting: { type: "string" },
    tone: { type: "string" },
    locations: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, description: { type: "string" } },
        required: ["name", "description"],
        additionalProperties: false,
      },
    },
    npcs: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, description: { type: "string" } },
        required: ["name", "description"],
        additionalProperties: false,
      },
    },
    arc: {
      type: "array",
      items: {
        type: "object",
        properties: { act: { type: "integer" }, summary: { type: "string" } },
        required: ["act", "summary"],
        additionalProperties: false,
      },
    },
    partyHook: { type: "string" },
  },
  required: ["title", "setting", "tone", "locations", "npcs", "arc", "partyHook"],
  additionalProperties: false,
} as const;

const STATS_SCHEMA = {
  type: "object",
  properties: {
    brave: { type: "integer" },
    smart: { type: "integer" },
    charm: { type: "integer" },
    sneaky: { type: "integer" },
  },
  required: ["brave", "smart", "charm", "sneaky"],
  additionalProperties: false,
} as const;

export const CONCEPTS_SCHEMA = {
  type: "object",
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          species: { type: "string" },
          tagline: { type: "string" },
          emoji: { type: "string" },
          suggestedStats: STATS_SCHEMA,
        },
        required: ["id", "name", "species", "tagline", "emoji", "suggestedStats"],
        additionalProperties: false,
      },
    },
  },
  required: ["concepts"],
  additionalProperties: false,
} as const;
