import { concatBytes, utf8Decode, utf8Encode } from "./bytes.js";

/**
 * Minimal HTTP/1.1 — exactly the subset a phone serving ≤7 LAN browsers
 * needs: GET requests, headers, no bodies in, small static bodies out.
 */

export interface HttpRequest {
  method: string;
  /** Path without query string, URL-decoded, e.g. "/join". */
  path: string;
  /** Raw query string without "?", e.g. "g=abc". */
  query: string;
  /** Header names lowercased. */
  headers: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  headers?: Record<string, string>;
  body?: Uint8Array | string;
}

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  400: "Bad Request",
  404: "Not Found",
  405: "Method Not Allowed",
  426: "Upgrade Required",
  500: "Internal Server Error",
};

export const MAX_HEADER_BYTES = 16 * 1024;

/**
 * Incremental request parser: feed chunks, get a request back once the
 * header block is complete. Returns `null` while incomplete and throws on
 * malformed or oversized input.
 */
export class HttpRequestParser {
  private buffer: Uint8Array = new Uint8Array(0);

  /** Feed a chunk; returns {request, remainder} when the headers complete. */
  feed(chunk: Uint8Array): { request: HttpRequest; remainder: Uint8Array } | null {
    this.buffer = concatBytes(this.buffer, chunk);
    if (this.buffer.length > MAX_HEADER_BYTES) {
      throw new Error("http: header block too large");
    }

    const end = findHeaderEnd(this.buffer);
    if (end === -1) return null;

    const head = utf8Decode(this.buffer.subarray(0, end));
    const remainder = this.buffer.subarray(end + 4);
    this.buffer = new Uint8Array(0);

    const lines = head.split("\r\n");
    const requestLine = lines[0] ?? "";
    const m = requestLine.match(/^([A-Z]+) (\S+) HTTP\/1\.[01]$/);
    if (!m) throw new Error(`http: bad request line: ${requestLine.slice(0, 80)}`);

    const method = m[1]!;
    const target = m[2]!;
    const qIdx = target.indexOf("?");
    const rawPath = qIdx === -1 ? target : target.slice(0, qIdx);
    const query = qIdx === -1 ? "" : target.slice(qIdx + 1);

    let path: string;
    try {
      path = decodeURIComponent(rawPath);
    } catch {
      throw new Error("http: undecodable path");
    }

    const headers: Record<string, string> = {};
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!;
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
    }

    return { request: { method, path, query, headers }, remainder };
  }
}

function findHeaderEnd(buf: Uint8Array): number {
  for (let i = 0; i + 3 < buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) {
      return i;
    }
  }
  return -1;
}

export function serializeResponse(res: HttpResponse): Uint8Array {
  const body =
    res.body === undefined
      ? new Uint8Array(0)
      : typeof res.body === "string"
        ? utf8Encode(res.body)
        : res.body;

  const headers: Record<string, string> = {
    connection: "close",
    "content-length": String(body.length),
    ...lowercaseKeys(res.headers ?? {}),
  };

  let head = `HTTP/1.1 ${res.status} ${STATUS_TEXT[res.status] ?? "OK"}\r\n`;
  for (const [k, v] of Object.entries(headers)) {
    head += `${k}: ${v}\r\n`;
  }
  head += "\r\n";

  return concatBytes(utf8Encode(head), body);
}

function lowercaseKeys(obj: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) out[k.toLowerCase()] = v;
  return out;
}

export function parseQuery(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const k = eq === -1 ? pair : pair.slice(0, eq);
    const v = eq === -1 ? "" : pair.slice(eq + 1);
    try {
      out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
    } catch {
      // skip undecodable pairs
    }
  }
  return out;
}
