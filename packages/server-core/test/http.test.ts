import { describe, expect, it } from "vitest";
import { HttpRequestParser, parseQuery, serializeResponse } from "../src/http.js";
import { utf8Decode, utf8Encode } from "../src/bytes.js";

describe("HttpRequestParser", () => {
  it("parses a simple GET", () => {
    const parser = new HttpRequestParser();
    const result = parser.feed(
      utf8Encode("GET /join?g=abc HTTP/1.1\r\nHost: 192.168.1.5:8787\r\nUpgrade: websocket\r\n\r\n"),
    );
    expect(result).not.toBeNull();
    expect(result!.request).toMatchObject({
      method: "GET",
      path: "/join",
      query: "g=abc",
    });
    expect(result!.request.headers["host"]).toBe("192.168.1.5:8787");
    expect(result!.request.headers["upgrade"]).toBe("websocket");
  });

  it("returns null until the header block completes, across chunks", () => {
    const parser = new HttpRequestParser();
    expect(parser.feed(utf8Encode("GET / HT"))).toBeNull();
    expect(parser.feed(utf8Encode("TP/1.1\r\nHost: x\r\n"))).toBeNull();
    const result = parser.feed(utf8Encode("\r\n"));
    expect(result!.request.path).toBe("/");
  });

  it("hands back remainder bytes after the header block (WS handshake pipelining)", () => {
    const parser = new HttpRequestParser();
    const head = utf8Encode("GET /ws HTTP/1.1\r\nHost: x\r\n\r\n");
    const framed = new Uint8Array([...head, 0x81, 0x85]);
    const result = parser.feed(framed);
    expect(Array.from(result!.remainder)).toEqual([0x81, 0x85]);
  });

  it("throws on garbage request lines", () => {
    const parser = new HttpRequestParser();
    expect(() => parser.feed(utf8Encode("HELLO WORLD\r\n\r\n"))).toThrow();
  });

  it("throws when headers exceed the cap", () => {
    const parser = new HttpRequestParser();
    const big = utf8Encode("GET / HTTP/1.1\r\nX-Big: " + "a".repeat(20_000));
    expect(() => parser.feed(big)).toThrow(/too large/);
  });
});

describe("serializeResponse", () => {
  it("writes status line, headers, content-length and body", () => {
    const bytes = serializeResponse({
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: "<h1>hi</h1>",
    });
    const text = utf8Decode(bytes);
    expect(text.startsWith("HTTP/1.1 200 OK\r\n")).toBe(true);
    expect(text).toContain("content-type: text/html\r\n");
    expect(text).toContain("content-length: 11\r\n");
    expect(text.endsWith("\r\n\r\n<h1>hi</h1>")).toBe(true);
  });
});

describe("parseQuery", () => {
  it("decodes pairs", () => {
    expect(parseQuery("g=abc&name=Ay%C5%9Fe+Y%C4%B1lmaz")).toEqual({
      g: "abc",
      name: "Ayşe Yılmaz",
    });
  });
  it("tolerates empty and valueless keys", () => {
    expect(parseQuery("")).toEqual({});
    expect(parseQuery("flag")).toEqual({ flag: "" });
  });
});
