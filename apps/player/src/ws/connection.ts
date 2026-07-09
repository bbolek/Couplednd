import {
  parseServerMessage,
  type ClientMessage,
  type Language,
} from "@familyquest/shared";
import { usePlayerStore } from "../state/playerStore.js";
import { setLanguage } from "../i18n.js";

/**
 * The player's link to the host phone. Exponential-backoff reconnect with a
 * stored token, so a locked phone or a WiFi hiccup never loses a character.
 */

const BACKOFF_START_MS = 500;
const BACKOFF_MAX_MS = 5000;
const MAX_ATTEMPTS = 20;

interface StoredIdentity {
  playerToken: string;
  playerId: string;
}

function storageKey(gameId: string): string {
  return `familyquest:${gameId}`;
}

export function loadIdentity(gameId: string): StoredIdentity | null {
  try {
    const raw = localStorage.getItem(storageKey(gameId));
    return raw ? (JSON.parse(raw) as StoredIdentity) : null;
  } catch {
    return null;
  }
}

function saveIdentity(gameId: string, identity: StoredIdentity): void {
  try {
    localStorage.setItem(storageKey(gameId), JSON.stringify(identity));
  } catch {
    // Private-mode Safari: play on without resume support.
  }
}

export class GameConnection {
  private ws: WebSocket | null = null;
  private attempts = 0;
  private closedByUs = false;
  private pendingName: string | undefined;

  constructor(private readonly gameId: string) {}

  /** Connect and join. `name` is only needed on first join. */
  connect(name?: string): void {
    this.pendingName = name ?? this.pendingName;
    this.closedByUs = false;
    this.open();
  }

  private open(): void {
    const store = usePlayerStore.getState();
    store.setStatus(this.attempts === 0 ? "connecting" : "reconnecting");

    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    this.ws = ws;

    ws.addEventListener("open", () => {
      const identity = loadIdentity(this.gameId);
      this.send({
        type: "join",
        gameId: this.gameId,
        name: this.pendingName,
        playerToken: identity?.playerToken,
      });
    });

    ws.addEventListener("message", (ev) => this.handleMessage(String(ev.data)));

    ws.addEventListener("close", () => {
      if (this.closedByUs) return;
      const s = usePlayerStore.getState();
      if (this.attempts >= MAX_ATTEMPTS) {
        s.setStatus("failed");
        return;
      }
      s.setStatus("reconnecting");
      const delay = Math.min(BACKOFF_START_MS * 2 ** this.attempts, BACKOFF_MAX_MS);
      this.attempts += 1;
      setTimeout(() => this.open(), delay);
    });
  }

  private handleMessage(raw: string): void {
    const msg = parseServerMessage(raw);
    if (!msg) return;
    const store = usePlayerStore.getState();

    switch (msg.type) {
      case "joined":
        this.attempts = 0;
        saveIdentity(this.gameId, { playerToken: msg.playerToken, playerId: msg.playerId });
        store.setJoined(msg.playerId);
        store.setStatus("online");
        break;
      case "state:snapshot":
        setLanguage(msg.state.language as Language);
        store.setSnapshot(msg.state);
        break;
      case "event":
        store.applyGameEvent(msg.event);
        break;
      case "error":
        store.setError(msg.code);
        if (msg.code === "BAD_TOKEN") {
          // Stale identity from an older game on the same id — start fresh.
          try {
            localStorage.removeItem(storageKey(this.gameId));
          } catch {
            /* ignore */
          }
        }
        break;
      case "pong":
        break;
    }
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  close(): void {
    this.closedByUs = true;
    this.ws?.close();
  }
}
