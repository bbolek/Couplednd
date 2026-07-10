# 🎲 Family Quest

**An AI Dungeon Master for families who have never played D&D.**

Family Quest turns your living room into an adventure table. The AI Dungeon Master
(powered by the Claude API) builds a world out of TV shows and movies your family
already loves — *"Bluey meets Star Wars"* — and runs a cozy, kid-safe adventure.
Everyone plays from their own phone.

## How it works

1. A small **game server** (Node.js, e.g. on a Hetzner VPS) runs the games and
   holds the Claude API key. Nobody's phone has to host anything.
2. **Host** opens the app on their phone, enters the server address + family
   passcode once in Settings, and starts a new game by typing a few favorite shows.
3. The AI DM **builds a world** from that mashup and suggests cute character concepts.
4. Family members **scan a QR code** and join from their phone's browser —
   no app install needed.
5. Each player **creates a character** on their own phone: pick a concept card,
   name it, choose an adorable avatar, and allocate stat points
   (Brave 💪 / Smart 🧠 / Charm 💖 / Sneaky 🐾).
6. The DM narrates in short, engaging beats, assigns tasks to specific players,
   and asks for **d20 dice rolls** — rolled with a satisfying tumble animation on
   the player's own phone.
7. Nobody dies. Characters get *knocked out* and need rescuing. 💫

English & Türkçe. Default model: Claude Opus 4.8 (Sonnet 5 / Haiku 4.5 selectable).

## Repository layout

| Path | What it is |
|---|---|
| `apps/server` | **The game server** — hosts many games, serves the player SPA, calls Claude |
| `apps/host` | Expo (React Native) host app — remote control: DM screen, game table, QR code |
| `apps/player` | The player web client (Vite + React), served from the game server |
| `apps/devhost` | Node dev server: play the whole game in desktop browsers, no phones needed |
| `packages/shared` | Protocols (player + host control), game state, rules math, i18n, design tokens |
| `packages/server-core` | Minimal portable HTTP/1.1 + WebSocket server |
| `packages/engine` | Game session logic + the Claude DM engine |

## Architecture

```
host app  ──ws──▶  ws://<server>/host          create/steer the game (passcode-gated)
players   ──http─▶ http://<server>/join?g=…    player SPA (QR code target)
players   ──ws──▶  ws://<server>/ws?g=…        live game protocol
```

The server keeps the Anthropic API key in an environment variable
(`ANTHROPIC_API_KEY`) — it never exists in the apps. Creating games requires the
`FQ_HOST_KEY` passcode, which the host enters once in the app's Settings.

## Development

```sh
pnpm install
pnpm build          # builds shared, server-core, engine, player, server
pnpm test           # unit + integration tests (no API spend)
pnpm dev            # devhost: play at http://localhost:8787 in two browser tabs
```

### Dev loop without phones

`pnpm dev` starts the devhost with a **mock DM** (scripted adventure, zero API cost).
Open `http://localhost:8787/join?g=dev` in a couple of tabs for players. Set
`ANTHROPIC_API_KEY` to use the real DM from the devhost.

### Running the real game server locally

```sh
pnpm --filter @familyquest/player build
FQ_MOCK_DM=1 FQ_HOST_KEY=test pnpm --filter @familyquest/server dev
```

Point the host app's Settings at `<your-machine-ip>:8787` with passcode `test`.
Use `ANTHROPIC_API_KEY=sk-ant-…` instead of `FQ_MOCK_DM=1` for the real DM.

Server environment:

| Variable | Meaning |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key (required unless `FQ_MOCK_DM=1`) |
| `FQ_HOST_KEY` | Family passcode required to create games (required) |
| `PORT` | Listen port (default 8787) |
| `FQ_MAX_GAMES` | Max concurrent games (default 20) |
| `FQ_GAME_TTL_MS` | Idle game expiry (default 3h) |
| `PUBLIC_ORIGIN` | Overrides join-URL origin (defaults to the request's Host header) |
| `FQ_PLAYER_DIST` | Player SPA directory (default `apps/player/dist`) |

## Deployment (Hetzner)

Pushes to the default branch build a Docker image, publish it to GHCR, and
restart the container on your server (`.github/workflows/deploy.yml`).

One-time setup:

1. Create a small Hetzner VPS (any Ubuntu/Debian image) and install Docker:
   `curl -fsSL https://get.docker.com | sh`
2. In the GitHub repo, add the Actions secrets:
   `HETZNER_HOST`, `HETZNER_USER`, `HETZNER_SSH_KEY` (SSH access),
   `ANTHROPIC_API_KEY`, and `FQ_HOST_KEY` (pick a family passcode).
3. Push — or run the *Deploy to Hetzner* workflow manually. The container
   listens on port 80.

Then in the host app's Settings: server address = your server's IP,
passcode = the `FQ_HOST_KEY` you chose. Players join at
`http://<server-ip>/join?g=…` via the QR code — no setup on their side.

Build the host app with `npx expo run:ios|android` inside `apps/host`. Since
the embedded TCP server (and its native module) is gone, the app is a plain
Expo project again.
