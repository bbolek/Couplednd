import type { WsConnection } from "./websocket.js";

export interface HubClient {
  clientId: string;
  ws: WsConnection;
  /** Application-level identity, set after a successful join. */
  playerId?: string;
}

export interface HubOptions {
  /** Ping cadence in ms (default 10s). */
  heartbeatMs?: number;
  /** Drop a client after this many unanswered pings (default 2). */
  maxMissedPings?: number;
  onClientClosed?: (client: HubClient) => void;
}

/**
 * Connection registry + heartbeat. Knows nothing about the game — the game
 * session layers on top by mapping playerIds to clients.
 */
export class Hub {
  private clients = new Map<string, HubClient>();
  private missed = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextId = 1;

  constructor(private readonly options: HubOptions = {}) {}

  add(ws: WsConnection): HubClient {
    const client: HubClient = { clientId: `c${this.nextId++}`, ws };
    this.clients.set(client.clientId, client);
    this.missed.set(client.clientId, 0);

    ws.onClose(() => {
      this.clients.delete(client.clientId);
      this.missed.delete(client.clientId);
      this.options.onClientClosed?.(client);
    });

    this.ensureHeartbeat();
    return client;
  }

  get(clientId: string): HubClient | undefined {
    return this.clients.get(clientId);
  }

  /** All clients that have completed a join (playerId assigned). */
  byPlayer(playerId: string): HubClient | undefined {
    for (const client of this.clients.values()) {
      if (client.playerId === playerId) return client;
    }
    return undefined;
  }

  get size(): number {
    return this.clients.size;
  }

  broadcast(text: string): void {
    for (const client of this.clients.values()) {
      if (client.playerId !== undefined) client.ws.sendText(text);
    }
  }

  sendTo(playerId: string, text: string): boolean {
    const client = this.byPlayer(playerId);
    if (!client) return false;
    client.ws.sendText(text);
    return true;
  }

  private ensureHeartbeat(): void {
    if (this.timer) return;
    const heartbeatMs = this.options.heartbeatMs ?? 10_000;
    const maxMissed = this.options.maxMissedPings ?? 2;

    this.timer = setInterval(() => {
      for (const client of this.clients.values()) {
        if (client.ws.alive) {
          client.ws.alive = false;
          this.missed.set(client.clientId, 0);
          client.ws.ping();
        } else {
          const misses = (this.missed.get(client.clientId) ?? 0) + 1;
          this.missed.set(client.clientId, misses);
          if (misses >= maxMissed) {
            client.ws.close(1001);
          } else {
            client.ws.ping();
          }
        }
      }
      if (this.clients.size === 0) this.stopHeartbeat();
    }, heartbeatMs);
  }

  private stopHeartbeat(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  closeAll(): void {
    for (const client of this.clients.values()) client.ws.close(1001);
    this.stopHeartbeat();
  }
}

/** Cryptographically-random-enough session token for LAN reconnects. */
export function generateToken(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return token;
}
