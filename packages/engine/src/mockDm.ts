import type {
  CharacterConcept,
  Language,
  PlayerId,
  WorldBible,
} from "@familyquest/shared";
import type { AttributedAction, DMActions, DMEngine } from "./dmTypes.js";

/**
 * A scripted Dungeon Master for development and integration tests — plays a
 * complete little adventure (scene → dice → task → item → knock-out →
 * rescue → epilogue) with zero API spend. Narration is "streamed" word by
 * word so the UI's streaming path is exercised for real.
 */

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface MockDMOptions {
  /** Delay between streamed words (0 in tests). */
  wordDelayMs?: number;
  /** Provide player ids in the order the script should engage them. */
  getPlayerIds: () => PlayerId[];
}

export function createMockDM(options: MockDMOptions) {
  return (actions: DMActions): DMEngine => new MockDM(actions, options);
}

class MockDM implements DMEngine {
  private messageNum = 0;
  private beatNum = 0;
  private cancelled = false;

  constructor(
    private readonly actions: DMActions,
    private readonly options: MockDMOptions,
  ) {}

  async generateWorld(shows: string[], _language: Language): Promise<WorldBible> {
    await sleep(10);
    const mashup = shows.join(" × ") || "A Cozy Kingdom";
    return {
      title: `The World of ${mashup}`,
      setting: `A wondrous land where ${mashup} blend together.`,
      tone: "warm, playful, gently exciting",
      locations: [
        { name: "The Glowing Meadow", description: "Soft grass that hums little songs." },
        { name: "The Upside-Down Lighthouse", description: "Its light shines into the ground." },
      ],
      npcs: [
        { name: "Pip", description: "A tiny map-maker who is afraid of blank paper." },
        { name: "Grandmother Cloud", description: "Rains only when she laughs." },
      ],
      arc: [
        { act: 1, summary: "Something precious has gone missing." },
        { act: 2, summary: "The trail leads somewhere unexpected." },
        { act: 3, summary: "Friendship saves the day." },
      ],
      partyHook: "Pip's magical map has flown away on the wind!",
    };
  }

  async generateConcepts(
    _world: WorldBible,
    _language: Language,
    count: number,
  ): Promise<CharacterConcept[]> {
    await sleep(10);
    const all: CharacterConcept[] = [
      {
        id: "c1",
        name: "Nova",
        species: "Star Puppy",
        tagline: "Barks in constellations",
        emoji: "🐶",
        suggestedStats: { brave: 3, smart: 1, charm: 3, sneaky: 1 },
      },
      {
        id: "c2",
        name: "Miko",
        species: "Cloud Fox",
        tagline: "Can nap anywhere, even mid-air",
        emoji: "🦊",
        suggestedStats: { brave: 1, smart: 3, charm: 1, sneaky: 3 },
      },
      {
        id: "c3",
        name: "Boop",
        species: "Round Robot",
        tagline: "Fixes things by hugging them",
        emoji: "🤖",
        suggestedStats: { brave: 2, smart: 4, charm: 2, sneaky: 0 },
      },
      {
        id: "c4",
        name: "Fern",
        species: "Sprout Sprite",
        tagline: "Grows a flower when happy",
        emoji: "🧚",
        suggestedStats: { brave: 1, smart: 2, charm: 4, sneaky: 1 },
      },
      {
        id: "c5",
        name: "Ziggy",
        species: "Pocket Dragon",
        tagline: "Sneezes tiny fireworks",
        emoji: "🐲",
        suggestedStats: { brave: 4, smart: 1, charm: 2, sneaky: 1 },
      },
      {
        id: "c6",
        name: "Willow",
        species: "Night Owl Scout",
        tagline: "Sees every secret path",
        emoji: "🦉",
        suggestedStats: { brave: 2, smart: 2, charm: 0, sneaky: 4 },
      },
    ];
    return all.slice(0, count);
  }

  private async narrate(text: string): Promise<void> {
    const messageId = `mock_m${++this.messageNum}`;
    const words = text.split(" ");
    for (let i = 0; i < words.length; i++) {
      if (this.cancelled) return;
      this.actions.narrationChunk(messageId, (i === 0 ? "" : " ") + words[i]);
      const delay = this.options.wordDelayMs ?? 40;
      if (delay > 0) await sleep(delay);
    }
    this.actions.narrationDone(messageId);
  }

  async startAdventure(): Promise<void> {
    const players = this.options.getPlayerIds();
    const [first, second] = [players[0], players[1] ?? players[0]];
    if (!first) return;

    this.actions.setScene({
      title: "The Glowing Meadow",
      summary: "Where the adventure begins",
      imagePrompt: "a glowing meadow at dusk, cozy storybook style",
    });

    await this.narrate(
      "The meadow hums a gentle song as you arrive. Pip the map-maker is hopping " +
        "up and down: “My map! The wind took my magical map!” High above, a paper " +
        "shape flutters toward the old oak tree.",
    );
    if (this.cancelled) return;

    const roll = await this.actions.requestDiceRoll({
      playerId: first,
      stat: "brave",
      dc: 10,
      reason: "Climb the whispering oak to reach the map",
    });
    if (this.cancelled) return;

    if (roll.outcome === "success" || roll.outcome === "critSuccess") {
      await this.narrate(
        "Up you go, branch by branch! Your paws find every hold, and the map " +
          "flutters right into your arms. Pip cheers so hard his hat falls off.",
      );
      this.actions.awardItem(first, {
        name: "Pip's Magical Map",
        emoji: "🗺️",
        description: "Shows the way to whatever you miss most",
      });
    } else {
      await this.narrate(
        "The branches wiggle and giggle — this tree is ticklish! You slide down " +
          "into a pile of leaves with a soft floof. The map drifts higher…",
      );
      this.actions.updateHp(first, -1, "a bonk from a ticklish branch");
    }
    if (this.cancelled) return;

    const answer = await this.actions.assignTask({
      playerId: second!,
      prompt: "Grandmother Cloud floats down, curious. What do you say to make her laugh?",
    });
    if (this.cancelled) return;

    await this.narrate(
      `You say: “${answer}” — and Grandmother Cloud bursts into giggles! A warm ` +
        "little rain falls, and a rainbow bends right down to the meadow like a slide.",
    );

    this.actions.endScene("The party recovered the map and befriended Grandmother Cloud.");
    await this.narrate("Where the rainbow touches the grass, something glitters…");
  }

  async playerAction(action: AttributedAction): Promise<void> {
    this.beatNum += 1;
    await this.narrate(
      `${action.characterName} tries to ${action.text.toLowerCase().replace(/^i (want to|will|try to)\s*/i, "")}. ` +
        (this.beatNum % 2 === 0
          ? "It works better than anyone hoped!"
          : "The meadow rustles thoughtfully. Something stirs nearby…"),
    );
    if (this.beatNum >= 4) {
      this.actions.endAdventure(
        "With the map safe and new friends made, the party heads home under a sky full of grateful stars. The end… for tonight!",
      );
    }
  }

  async nudge(instruction: string): Promise<void> {
    await this.narrate(`(The storyteller leans in.) ${instruction}`);
  }

  cancel(): void {
    this.cancelled = true;
  }
}
