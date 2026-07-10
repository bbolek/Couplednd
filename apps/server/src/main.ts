/**
 * Family Quest game server — the always-on home for family adventures.
 *
 * One process hosts many games: the host app remote-controls a game over
 * ws://<server>/host, players join from their browsers at
 * http://<server>/join?g=<gameId> (SPA served from here) and play over
 * ws://<server>/ws?g=<gameId>. The Anthropic API key lives here, in env —
 * never on a phone.
 *
 *   ANTHROPIC_API_KEY=sk-ant-… FQ_HOST_KEY=<family passcode> pnpm dev
 *   FQ_MOCK_DM=1 FQ_HOST_KEY=test pnpm dev            # zero API spend
 */
import { loadConfig } from "./config.js";
import { loadPlayerAssets } from "./assets.js";
import { GameManager } from "./games.js";
import { startApp } from "./app.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const assets = loadPlayerAssets(config.playerDistDir);
  const games = new GameManager({
    anthropicApiKey: config.anthropicApiKey,
    mockDM: config.mockDM,
    maxGames: config.maxGames,
    gameTtlMs: config.gameTtlMs,
  });

  const server = await startApp({
    port: config.port,
    hostKey: config.hostKey,
    publicOrigin: config.publicOrigin,
    assets,
    games,
  });

  console.log(`🎲 Family Quest server listening on :${config.port}`);
  console.log(`   DM: ${config.mockDM ? "scripted mock" : "Claude"} · max games: ${config.maxGames}`);

  const shutdown = (): void => {
    console.log("shutting down…");
    games.closeAll();
    void server.close().then(() => process.exit(0));
    // Failsafe if a socket refuses to die.
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
