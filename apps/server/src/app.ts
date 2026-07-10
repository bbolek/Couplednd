import { parseQuery, startServer, type RunningServer, type StaticAsset } from "@familyquest/server-core";
import { nodeTransport } from "@familyquest/server-core/node";
import { serializeServerMessage } from "@familyquest/shared";
import type { GameManager } from "./games.js";
import { attachHostChannel } from "./hostChannel.js";

export interface AppOptions {
  port: number;
  hostKey: string;
  publicOrigin: string | null;
  assets: Map<string, StaticAsset>;
  games: GameManager;
}

/**
 * HTTP + WS wiring for the game server: player SPA on `/` and `/join`,
 * players on `/ws?g=<gameId>`, the host app on `/host`, health on `/health`.
 */
export function startApp(options: AppOptions): Promise<RunningServer> {
  const { games } = options;
  const index = options.assets.get("/index.html");

  return startServer({
    transport: nodeTransport,
    port: options.port,
    host: "0.0.0.0",
    staticAssets: options.assets,
    wsPath: ["/ws", "/host"],
    onWebSocket: (ws, req) => {
      if (req.path === "/host") {
        attachHostChannel(ws, req, {
          games,
          hostKey: options.hostKey,
          publicOrigin: options.publicOrigin,
        });
        return;
      }
      // Player socket: route to the game named in the query string.
      const gameId = parseQuery(req.query)["g"] ?? "";
      const record = games.get(gameId);
      if (!record) {
        ws.sendText(
          serializeServerMessage({
            type: "error",
            code: "GAME_NOT_FOUND",
            message: "No such adventure on this server.",
          }),
        );
        ws.close(1008);
        return;
      }
      games.touch(record);
      record.session.attach(ws);
    },
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
          body: JSON.stringify({ ok: true, games: games.size }),
        };
      }
      return undefined;
    },
  });
}
