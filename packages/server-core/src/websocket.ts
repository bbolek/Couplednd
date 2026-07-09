import { base64Encode, concatBytes, sha1, utf8Decode, utf8Encode } from "./bytes.js";
import type { HttpRequest } from "./http.js";

/**
 * RFC 6455 — the subset Family Quest uses: server side only, text frames,
 * ping/pong, close, client-to-server masking (mandatory per spec), and
 * basic continuation-frame reassembly. No extensions, no compression.
 */

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export const OPCODE = {
  continuation: 0x0,
  text: 0x1,
  binary: 0x2,
  close: 0x8,
  ping: 0x9,
  pong: 0xa,
} as const;

/** Hard cap on a single message — our JSON frames are tiny; 1 MiB is generous. */
export const MAX_MESSAGE_BYTES = 1024 * 1024;

export function computeAcceptKey(secWebSocketKey: string): string {
  return base64Encode(sha1(utf8Encode(secWebSocketKey + WS_GUID)));
}

export function isUpgradeRequest(req: HttpRequest): boolean {
  return (
    req.headers["upgrade"]?.toLowerCase() === "websocket" &&
    (req.headers["connection"] ?? "").toLowerCase().includes("upgrade") &&
    typeof req.headers["sec-websocket-key"] === "string"
  );
}

export function buildHandshakeResponse(req: HttpRequest): Uint8Array {
  const key = req.headers["sec-websocket-key"]!;
  const accept = computeAcceptKey(key);
  return utf8Encode(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "upgrade: websocket\r\n" +
      "connection: Upgrade\r\n" +
      `sec-websocket-accept: ${accept}\r\n` +
      "\r\n",
  );
}

export interface WsFrame {
  fin: boolean;
  opcode: number;
  payload: Uint8Array;
}

/** Encode a server→client frame (never masked). */
export function encodeFrame(opcode: number, payload: Uint8Array, fin = true): Uint8Array {
  const len = payload.length;
  let header: Uint8Array;
  if (len < 126) {
    header = new Uint8Array(2);
    header[1] = len;
  } else if (len < 65536) {
    header = new Uint8Array(4);
    header[1] = 126;
    header[2] = (len >> 8) & 0xff;
    header[3] = len & 0xff;
  } else {
    header = new Uint8Array(10);
    header[1] = 127;
    // Our messages never exceed 2^32; write the high 32 bits as zero.
    header[2] = header[3] = header[4] = header[5] = 0;
    header[6] = (len >>> 24) & 0xff;
    header[7] = (len >>> 16) & 0xff;
    header[8] = (len >>> 8) & 0xff;
    header[9] = len & 0xff;
  }
  header[0] = (fin ? 0x80 : 0x00) | (opcode & 0x0f);
  return concatBytes(header, payload);
}

export function encodeTextFrame(text: string): Uint8Array {
  return encodeFrame(OPCODE.text, utf8Encode(text));
}

export function encodeCloseFrame(code = 1000): Uint8Array {
  const payload = new Uint8Array(2);
  payload[0] = (code >> 8) & 0xff;
  payload[1] = code & 0xff;
  return encodeFrame(OPCODE.close, payload);
}

export function encodePingFrame(): Uint8Array {
  return encodeFrame(OPCODE.ping, new Uint8Array(0));
}

export function encodePongFrame(payload: Uint8Array = new Uint8Array(0)): Uint8Array {
  return encodeFrame(OPCODE.pong, payload);
}

/**
 * Incremental frame decoder for one connection. Feed raw bytes, receive
 * complete frames. Client frames MUST be masked (RFC 6455 §5.1) — unmasked
 * input is a protocol error.
 */
export class WsFrameDecoder {
  private buffer: Uint8Array = new Uint8Array(0);

  feed(chunk: Uint8Array): WsFrame[] {
    this.buffer = concatBytes(this.buffer, chunk);
    const frames: WsFrame[] = [];

    for (;;) {
      const parsed = this.tryParseOne();
      if (!parsed) break;
      frames.push(parsed);
    }
    return frames;
  }

  private tryParseOne(): WsFrame | null {
    const buf = this.buffer;
    if (buf.length < 2) return null;

    const b0 = buf[0]!;
    const b1 = buf[1]!;
    const fin = (b0 & 0x80) !== 0;
    const rsv = b0 & 0x70;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let payloadLen = b1 & 0x7f;
    let offset = 2;

    if (rsv !== 0) throw new Error("ws: RSV bits set (no extensions negotiated)");
    if (!masked) throw new Error("ws: client frame not masked");

    if (payloadLen === 126) {
      if (buf.length < offset + 2) return null;
      payloadLen = (buf[offset]! << 8) | buf[offset + 1]!;
      offset += 2;
    } else if (payloadLen === 127) {
      if (buf.length < offset + 8) return null;
      const high =
        (buf[offset]! << 24) | (buf[offset + 1]! << 16) | (buf[offset + 2]! << 8) | buf[offset + 3]!;
      if (high !== 0) throw new Error("ws: frame too large");
      payloadLen =
        buf[offset + 4]! * 0x1000000 +
        (buf[offset + 5]! << 16) +
        (buf[offset + 6]! << 8) +
        buf[offset + 7]!;
      offset += 8;
    }

    if (payloadLen > MAX_MESSAGE_BYTES) throw new Error("ws: frame too large");

    if (buf.length < offset + 4 + payloadLen) return null;
    const mask = buf.subarray(offset, offset + 4);
    offset += 4;

    const payload = new Uint8Array(payloadLen);
    for (let i = 0; i < payloadLen; i++) {
      payload[i] = buf[offset + i]! ^ mask[i % 4]!;
    }

    this.buffer = buf.subarray(offset + payloadLen);
    return { fin, opcode, payload };
  }
}

export type WsMessageHandler = (text: string) => void;

/**
 * A live server-side WebSocket connection: reassembles fragmented messages,
 * answers pings, tracks pong liveness, and exposes a tiny send/close API.
 */
export class WsConnection {
  private decoder = new WsFrameDecoder();
  private fragments: Uint8Array | null = null;
  private fragmentOpcode = 0;
  private closed = false;
  /** Set to false by the heartbeat, true whenever any client frame arrives. */
  alive = true;

  private messageHandlers: WsMessageHandler[] = [];
  private closeHandlers: (() => void)[] = [];

  constructor(
    private readonly writeRaw: (data: Uint8Array) => void,
    private readonly destroySocket: () => void,
  ) {}

  onMessage(cb: WsMessageHandler): void {
    this.messageHandlers.push(cb);
  }

  onClose(cb: () => void): void {
    this.closeHandlers.push(cb);
  }

  /** Feed raw socket bytes (called by the server plumbing). */
  feed(chunk: Uint8Array): void {
    if (this.closed) return;
    let frames: WsFrame[];
    try {
      frames = this.decoder.feed(chunk);
    } catch {
      this.close(1002);
      return;
    }

    for (const frame of frames) {
      this.alive = true;
      switch (frame.opcode) {
        case OPCODE.text:
        case OPCODE.binary:
          if (!frame.fin) {
            this.fragments = frame.payload;
            this.fragmentOpcode = frame.opcode;
          } else if (frame.opcode === OPCODE.text) {
            this.emitText(frame.payload);
          }
          break;
        case OPCODE.continuation:
          if (this.fragments === null) {
            this.close(1002);
            return;
          }
          this.fragments = concatBytes(this.fragments, frame.payload);
          if (this.fragments.length > MAX_MESSAGE_BYTES) {
            this.close(1009);
            return;
          }
          if (frame.fin) {
            if (this.fragmentOpcode === OPCODE.text) this.emitText(this.fragments);
            this.fragments = null;
          }
          break;
        case OPCODE.ping:
          this.writeSafely(encodePongFrame(frame.payload));
          break;
        case OPCODE.pong:
          break; // liveness already recorded above
        case OPCODE.close:
          this.close(1000);
          return;
        default:
          this.close(1002);
          return;
      }
    }
  }

  private emitText(payload: Uint8Array): void {
    const text = utf8Decode(payload);
    for (const cb of this.messageHandlers) cb(text);
  }

  sendText(text: string): void {
    this.writeSafely(encodeTextFrame(text));
  }

  ping(): void {
    this.writeSafely(encodePingFrame());
  }

  close(code = 1000): void {
    if (this.closed) return;
    this.closed = true;
    this.writeSafely(encodeCloseFrame(code));
    this.destroySocket();
    this.notifyClosed();
  }

  /** Called by the plumbing when the underlying socket dies. */
  socketClosed(): void {
    if (this.closed) return;
    this.closed = true;
    this.notifyClosed();
  }

  private notifyClosed(): void {
    for (const cb of this.closeHandlers) cb();
  }

  private writeSafely(data: Uint8Array): void {
    try {
      this.writeRaw(data);
    } catch {
      // Socket already dead; close path will run via onClose.
    }
  }
}
