# 🎲 Family Quest

**An AI Dungeon Master for families who have never played D&D.**

Family Quest turns your living room into an adventure table. The AI Dungeon Master
(powered by the Claude API) builds a world out of TV shows and movies your family
already loves — *"Bluey meets Star Wars"* — and runs a cozy, kid-safe adventure.
Everyone plays from their own phone.

## How it works

1. **Host** opens the app on their phone, enters their Claude API key once in Settings,
   and starts a new game by typing a few favorite shows.
2. The AI DM **builds a world** from that mashup and suggests cute character concepts.
3. Family members **scan a QR code** and join from their phone's browser —
   no app install needed. Everything runs over home WiFi.
4. Each player **creates a character** on their own phone: pick a concept card,
   name it, choose an adorable avatar, and allocate stat points
   (Brave 💪 / Smart 🧠 / Charm 💖 / Sneaky 🐾).
5. The DM narrates in short, engaging beats, assigns tasks to specific players,
   and asks for **d20 dice rolls** — rolled with a satisfying tumble animation on
   the player's own phone.
6. Nobody dies. Characters get *knocked out* and need rescuing. 💫

English & Türkçe. Default model: Claude Opus 4.8 (Sonnet 5 / Haiku 4.5 selectable).

## Repository layout

| Path | What it is |
|---|---|
| `apps/host` | Expo (React Native) host app — the DM screen, game table, and embedded server |
| `apps/player` | The player web client (Vite + React), served *from the host phone* |
| `apps/devhost` | Node dev server: play the whole game in desktop browsers, no phones needed |
| `packages/shared` | Protocol, game state, rules math, i18n resources, design tokens |
| `packages/server-core` | Minimal portable HTTP/1.1 + WebSocket server (runs on Node and React Native TCP) |

## Development

```sh
pnpm install
pnpm build          # builds shared, server-core, player (+ embeds player bundle)
pnpm test           # unit + integration tests (no API spend)
pnpm dev            # devhost: play at http://localhost:8787 in two browser tabs
```

The host app requires a dev client build (`npx expo run:ios|android` inside `apps/host`) —
Expo Go cannot run the embedded server.

### Dev loop without phones

`pnpm dev` starts the devhost with a **mock DM** (scripted adventure, zero API cost).
Open `http://localhost:8787/host` for the table view and `http://localhost:8787/join?g=dev`
in more tabs for players. Set `ANTHROPIC_API_KEY` to use the real DM from the devhost.
