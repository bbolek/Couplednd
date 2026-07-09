/**
 * Family Quest devhost — play the whole game in desktop browsers, no phones.
 *
 *   pnpm --filter @familyquest/player build   # once, to produce the SPA
 *   pnpm dev                                  # from the repo root
 *
 * Open http://localhost:8787/join?g=dev in 1-3 browser tabs, create
 * characters, then press <Enter> here to start the adventure.
 *
 * Uses the scripted MockDM by default (zero API spend). Run with a real DM:
 *   ANTHROPIC_API_KEY=sk-ant-… FQ_MODEL=claude-opus-4-8 pnpm dev
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { createInterface } from "node:readline";
import type { StaticAsset } from "@familyquest/server-core";
import { nodeTransport } from "@familyquest/server-core/node";
import { DEFAULT_PORT, type Audience, type Language } from "@familyquest/shared";
import {
  createClaudeDM,
  createMockDM,
  GameSession,
  joinUrl,
  startGameServer,
  type DMModel,
} from "@familyquest/engine";

const here = dirname(fileURLToPath(import.meta.url));
const playerDist = resolve(here, "../../player/dist");

const GAME_ID = process.env.FQ_GAME_ID ?? "dev";
const PORT = Number(process.env.FQ_PORT ?? DEFAULT_PORT);
const LANGUAGE = (process.env.FQ_LANG ?? "en") as Language;
const AUDIENCE = (process.env.FQ_AUDIENCE ?? "family") as Audience;
const SHOWS = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["Bluey", "Star Wars"];

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function loadAssets(): Map<string, StaticAsset> {
  const assets = new Map<string, StaticAsset>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const rel = "/" + relative(playerDist, full).replaceAll("\\", "/");
      const ext = rel.slice(rel.lastIndexOf("."));
      assets.set(rel, {
        contentType: CONTENT_TYPES[ext] ?? "application/octet-stream",
        body: new Uint8Array(gzipSync(readFileSync(full), { level: 9 })),
        gzipped: true,
      });
    }
  };
  try {
    walk(playerDist);
  } catch {
    console.error("✗ Player SPA not built. Run: pnpm --filter @familyquest/player build");
    process.exit(1);
  }
  return assets;
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = (process.env.FQ_MODEL ?? "claude-opus-4-8") as DMModel;

  const session: GameSession = new GameSession({
    gameId: GAME_ID,
    language: LANGUAGE,
    shows: SHOWS,
    audience: AUDIENCE,
    onError: (err) => console.error("DM error:", err),
    createDM: apiKey
      ? createClaudeDM({
          apiKey,
          model,
          language: LANGUAGE,
          audience: AUDIENCE,
          getParty: () =>
            Object.entries(session.getState().characters).map(([playerId, character]) => ({
              playerId,
              playerName: session.getState().players[playerId]?.name ?? "?",
              character,
            })),
          onUsage: (u) =>
            process.stdout.write(
              `\r  tokens in/out ${u.inputTokens}/${u.outputTokens} (cache read ${u.cacheReadTokens})   `,
            ),
        })
      : createMockDM({
          getPlayerIds: () =>
            Object.keys(session.getState().players).filter(
              (id) => session.getState().characters[id],
            ),
        }),
  });

  const server = await startGameServer({
    transport: nodeTransport,
    session,
    assets: loadAssets(),
    port: PORT,
    host: "0.0.0.0",
  });

  console.log(`\n🎲 Family Quest devhost`);
  console.log(`   world: ${SHOWS.join(" × ")}  ·  DM: ${apiKey ? `Claude (${model})` : "scripted mock"}`);
  console.log(`   players join at ${joinUrl("localhost", PORT, GAME_ID)}\n`);
  console.log(`   building world…`);

  await session.prepareWorld();
  const world = session.getState().setup.worldBible;
  console.log(`   ✓ ${world?.title}\n`);
  console.log(`   Waiting for players. Press <Enter> to start the adventure, Ctrl+C to quit.\n`);

  session.subscribe((state) => {
    const players = Object.values(state.players);
    const withCharacters = players.filter((p) => state.characters[p.playerId]);
    process.stdout.write(
      `\r  party: ${players.length} joined, ${withCharacters.length} heroes ready   `,
    );
  });

  const readline = createInterface({ input: process.stdin });
  readline.on("line", () => {
    const state = session.getState();
    if (state.phase === "lobby" || state.phase === "characterCreation") {
      const heroes = Object.keys(state.characters).length;
      if (heroes === 0) {
        console.log("\n  No heroes yet — create a character in a browser tab first.");
        return;
      }
      console.log("\n  🌟 Starting the adventure!\n");
      void session.startAdventure();
    } else {
      void session.nudge("Please wrap up the current beat and move the story along.");
    }
  });

  // Mirror narration to the console so the devhost doubles as a table view.
  const printed = new Set<string>();
  session.subscribe((state) => {
    for (const entry of state.log) {
      if (printed.has(entry.id)) continue;
      printed.add(entry.id);
      const icon = { narration: "📖", dice: "🎲", task: "🗣️", item: "🎁", status: "💫", scene: "🎬", system: "·" }[entry.kind];
      console.log(`  ${icon} ${entry.text}`);
    }
  });

  process.on("SIGINT", () => {
    console.log("\n  Goodnight, adventurers! 🌙");
    session.close();
    void server.close().then(() => process.exit(0));
  });
}

void main();
