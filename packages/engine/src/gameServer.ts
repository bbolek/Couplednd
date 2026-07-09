import {
  startServer,
  type RunningServer,
  type StaticAsset,
  type Transport,
} from "@familyquest/server-core";
import { DEFAULT_PORT } from "@familyquest/shared";
import type { GameSession } from "./session.js";

export interface GameServerOptions {
  transport: Transport;
  session: GameSession;
  /** Player SPA assets keyed by path ("/index.html", "/assets/app.js", …). */
  assets: Map<string, StaticAsset>;
  port?: number;
  host?: string;
}

/**
 * Serves the player SPA + the game WebSocket for one session.
 * `/` and `/join` both serve the SPA (the QR code points at
 * `/join?g=<gameId>`; the SPA reads the id from the query string).
 */
export async function startGameServer(options: GameServerOptions): Promise<RunningServer> {
  const index = options.assets.get("/index.html");

  return startServer({
    transport: options.transport,
    port: options.port ?? DEFAULT_PORT,
    host: options.host ?? "0.0.0.0",
    staticAssets: options.assets,
    wsPath: "/ws",
    onWebSocket: (ws) => options.session.attach(ws),
    onRequest: (req) => {
      if ((req.path === "/" || req.path === "/join") && index) {
        return {
          status: 200,
          headers: {
            "content-type": index.contentType,
            "cache-control": "no-cache",
            ...(index.gzipped ? { "content-encoding": "gzip" } : {}),
          },
          body: index.body,
        };
      }
      if (req.path === "/health") {
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ok: true, gameId: options.session.getState().gameId }),
        };
      }
      return undefined;
    },
  });
}

export function joinUrl(hostIp: string, port: number, gameId: string): string {
  return `http://${hostIp}:${port}/join?g=${encodeURIComponent(gameId)}`;
}
