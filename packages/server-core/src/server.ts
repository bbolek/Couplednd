import { HttpRequestParser, serializeResponse, type HttpRequest, type HttpResponse } from "./http.js";
import { buildHandshakeResponse, isUpgradeRequest, WsConnection } from "./websocket.js";
import type { Transport, TransportServer, TransportSocket } from "./transport.js";

export interface StaticAsset {
  contentType: string;
  body: Uint8Array;
  /** When true, body is already gzipped and served with Content-Encoding: gzip. */
  gzipped?: boolean;
}

export interface ServerOptions {
  transport: Transport;
  port: number;
  host?: string;
  /** Path → asset. Checked before `onRequest`. */
  staticAssets?: Map<string, StaticAsset>;
  /** Dynamic routes; return undefined to fall through to 404. */
  onRequest?: (req: HttpRequest) => HttpResponse | undefined;
  /** WebSocket endpoint path(s) (default /ws). */
  wsPath?: string | string[];
  onWebSocket: (ws: WsConnection, req: HttpRequest) => void;
}

export interface RunningServer {
  close(): Promise<void>;
}

/**
 * Ties the transport, HTTP parser, and WebSocket upgrade together. Each TCP
 * connection serves exactly one HTTP request (Connection: close) unless it
 * upgrades, in which case it becomes a long-lived WS connection.
 */
export async function startServer(options: ServerOptions): Promise<RunningServer> {
  const wsPaths = new Set(
    typeof options.wsPath === "string" ? [options.wsPath] : options.wsPath ?? ["/ws"],
  );
  const host = options.host ?? "0.0.0.0";

  const transportServer: TransportServer = await options.transport.listen(
    options.port,
    host,
    (socket) => handleConnection(socket, options, wsPaths),
  );

  return {
    close: () => transportServer.close(),
  };
}

function handleConnection(socket: TransportSocket, options: ServerOptions, wsPaths: Set<string>): void {
  const parser = new HttpRequestParser();
  let ws: WsConnection | null = null;

  socket.onError(() => {
    // onClose fires after; nothing to do here.
  });

  socket.onClose(() => {
    ws?.socketClosed();
  });

  socket.onData((chunk) => {
    if (ws) {
      ws.feed(chunk);
      return;
    }

    let parsed: { request: HttpRequest; remainder: Uint8Array } | null;
    try {
      parsed = parser.feed(chunk);
    } catch {
      socket.write(serializeResponse({ status: 400, body: "Bad Request" }));
      socket.end();
      return;
    }
    if (!parsed) return; // headers not complete yet

    const { request, remainder } = parsed;

    if (wsPaths.has(request.path)) {
      if (!isUpgradeRequest(request)) {
        socket.write(serializeResponse({ status: 426, body: "Upgrade Required" }));
        socket.end();
        return;
      }
      socket.write(buildHandshakeResponse(request));
      ws = new WsConnection(
        (data) => socket.write(data),
        () => socket.destroy(),
      );
      options.onWebSocket(ws, request);
      if (remainder.length > 0) ws.feed(remainder);
      return;
    }

    const response = routeHttp(request, options);
    socket.write(serializeResponse(response));
    socket.end();
  });
}

function routeHttp(request: HttpRequest, options: ServerOptions): HttpResponse {
  if (request.method !== "GET") {
    return { status: 405, body: "Method Not Allowed" };
  }

  const asset = options.staticAssets?.get(request.path);
  if (asset) {
    return {
      status: 200,
      headers: {
        "content-type": asset.contentType,
        "cache-control": "no-cache",
        ...(asset.gzipped ? { "content-encoding": "gzip" } : {}),
      },
      body: asset.body,
    };
  }

  const dynamic = options.onRequest?.(request);
  if (dynamic) return dynamic;

  return { status: 404, headers: { "content-type": "text/plain" }, body: "Not Found" };
}
