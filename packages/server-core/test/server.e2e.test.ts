import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startServer, type RunningServer } from "../src/server.js";
import { nodeTransport } from "../src/transports/node.js";
import { Hub } from "../src/hub.js";
import { utf8Encode } from "../src/bytes.js";

/**
 * End-to-end conformance: our hand-rolled HTTP+WS server must interoperate
 * with Node's real undici fetch and WebSocket clients — the same stacks
 * mobile browsers use semantically.
 */

const PORT = 18787;
let server: RunningServer;
let hub: Hub;

beforeAll(async () => {
  hub = new Hub({ heartbeatMs: 200, maxMissedPings: 2 });
  server = await startServer({
    transport: nodeTransport,
    port: PORT,
    host: "127.0.0.1",
    staticAssets: new Map([
      [
        "/",
        { contentType: "text/html; charset=utf-8", body: utf8Encode("<h1>Family Quest</h1>") },
      ],
    ]),
    onRequest: (req) => {
      if (req.path === "/health") {
        return { status: 200, headers: { "content-type": "application/json" }, body: '{"ok":true}' };
      }
      return undefined;
    },
    onWebSocket: (ws) => {
      const client = hub.add(ws);
      client.playerId = client.clientId; // auto-join for the echo test
      ws.onMessage((text) => {
        if (text === "broadcast!") hub.broadcast(`fanout:${text}`);
        else ws.sendText(`echo:${text}`);
      });
    },
  });
});

afterAll(async () => {
  hub.closeAll();
  await server.close();
});

describe("HTTP over the wire", () => {
  it("serves static assets to a real fetch client", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toBe("<h1>Family Quest</h1>");
  });

  it("serves dynamic routes", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/health`);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("404s unknown paths", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/nope`);
    expect(res.status).toBe(404);
  });

  it("rejects non-upgrade requests to /ws", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/ws`);
    expect(res.status).toBe(426);
  });
});

function openWs(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", (e) => reject(e));
  });
}

function nextMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve) => {
    ws.addEventListener("message", (ev) => resolve(String(ev.data)), { once: true });
  });
}

describe("WebSocket over the wire (Node's real WS client)", () => {
  it("completes the handshake and echoes text", async () => {
    const ws = await openWs();
    const reply = nextMessage(ws);
    ws.send("merhaba 🌟");
    expect(await reply).toBe("echo:merhaba 🌟");
    ws.close();
  });

  it("handles messages larger than 125 bytes (extended length)", async () => {
    const ws = await openWs();
    const big = "x".repeat(5000);
    const reply = nextMessage(ws);
    ws.send(big);
    expect(await reply).toBe(`echo:${big}`);
    ws.close();
  });

  it("broadcasts to multiple clients through the hub", async () => {
    const a = await openWs();
    const b = await openWs();
    const fromA = nextMessage(a);
    const fromB = nextMessage(b);
    a.send("broadcast!");
    expect(await fromA).toBe("fanout:broadcast!");
    expect(await fromB).toBe("fanout:broadcast!");
    a.close();
    b.close();
  });

  it("survives rapid connect/disconnect", async () => {
    for (let i = 0; i < 5; i++) {
      const ws = await openWs();
      ws.close();
    }
    const ws = await openWs();
    const reply = nextMessage(ws);
    ws.send("still alive");
    expect(await reply).toBe("echo:still alive");
    ws.close();
  });
});
