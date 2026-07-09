import { describe, expect, it } from "vitest";
import {
  computeAcceptKey,
  encodeFrame,
  encodeTextFrame,
  OPCODE,
  WsFrameDecoder,
} from "../src/websocket.js";
import { base64Encode, sha1, utf8Decode, utf8Encode } from "../src/bytes.js";

/** Build a masked client→server frame the way a browser would. */
function clientFrame(opcode: number, payload: Uint8Array, fin = true, mask = [1, 2, 3, 4]): Uint8Array {
  const len = payload.length;
  let head: number[];
  if (len < 126) head = [(fin ? 0x80 : 0) | opcode, 0x80 | len];
  else if (len < 65536) head = [(fin ? 0x80 : 0) | opcode, 0x80 | 126, len >> 8, len & 0xff];
  else throw new Error("test helper: payload too large");
  const out = new Uint8Array(head.length + 4 + len);
  out.set(head, 0);
  out.set(mask, head.length);
  for (let i = 0; i < len; i++) out[head.length + 4 + i] = payload[i]! ^ mask[i % 4]!;
  return out;
}

describe("sha1 / base64 (known-answer tests)", () => {
  it("sha1 of empty string", () => {
    const hex = Array.from(sha1(new Uint8Array(0)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(hex).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
  });

  it("sha1 of 'abc'", () => {
    const hex = Array.from(sha1(utf8Encode("abc")))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(hex).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
  });

  it("base64 round-trip vectors", () => {
    expect(base64Encode(utf8Encode("f"))).toBe("Zg==");
    expect(base64Encode(utf8Encode("fo"))).toBe("Zm8=");
    expect(base64Encode(utf8Encode("foo"))).toBe("Zm9v");
  });
});

describe("computeAcceptKey", () => {
  it("matches the RFC 6455 §1.3 worked example", () => {
    expect(computeAcceptKey("dGhlIHNhbXBsZSBub25jZQ==")).toBe(
      "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=",
    );
  });
});

describe("WsFrameDecoder", () => {
  it("decodes a small masked text frame", () => {
    const dec = new WsFrameDecoder();
    const frames = dec.feed(clientFrame(OPCODE.text, utf8Encode("hello")));
    expect(frames).toHaveLength(1);
    expect(utf8Decode(frames[0]!.payload)).toBe("hello");
    expect(frames[0]!.fin).toBe(true);
  });

  it("decodes a frame split across arbitrary chunk boundaries", () => {
    const dec = new WsFrameDecoder();
    const whole = clientFrame(OPCODE.text, utf8Encode("merhaba dünya 🌍"));
    let frames = dec.feed(whole.subarray(0, 3));
    expect(frames).toHaveLength(0);
    frames = dec.feed(whole.subarray(3, 7));
    expect(frames).toHaveLength(0);
    frames = dec.feed(whole.subarray(7));
    expect(frames).toHaveLength(1);
    expect(utf8Decode(frames[0]!.payload)).toBe("merhaba dünya 🌍");
  });

  it("decodes two frames arriving in one chunk", () => {
    const dec = new WsFrameDecoder();
    const a = clientFrame(OPCODE.text, utf8Encode("one"));
    const b = clientFrame(OPCODE.text, utf8Encode("two"));
    const joined = new Uint8Array([...a, ...b]);
    const frames = dec.feed(joined);
    expect(frames.map((f) => utf8Decode(f.payload))).toEqual(["one", "two"]);
  });

  it("decodes a 16-bit-length frame (>=126 bytes)", () => {
    const payload = utf8Encode("x".repeat(300));
    const dec = new WsFrameDecoder();
    const frames = dec.feed(clientFrame(OPCODE.text, payload));
    expect(frames[0]!.payload.length).toBe(300);
  });

  it("rejects unmasked client frames", () => {
    const dec = new WsFrameDecoder();
    // server-style (unmasked) frame fed as client input
    const unmasked = encodeTextFrame("nope");
    expect(() => dec.feed(unmasked)).toThrow(/not masked/);
  });
});

describe("encodeFrame", () => {
  it("small frame layout", () => {
    const f = encodeFrame(OPCODE.text, utf8Encode("hi"));
    expect(f[0]).toBe(0x81); // FIN + text
    expect(f[1]).toBe(2); // unmasked, len 2
    expect(utf8Decode(f.subarray(2))).toBe("hi");
  });

  it("uses 16-bit length form for 126..65535", () => {
    const f = encodeFrame(OPCODE.text, new Uint8Array(200));
    expect(f[1]).toBe(126);
    expect((f[2]! << 8) | f[3]!).toBe(200);
  });

  it("uses 64-bit length form beyond 65535", () => {
    const f = encodeFrame(OPCODE.binary, new Uint8Array(70000));
    expect(f[1]).toBe(127);
    const len =
      f[6]! * 0x1000000 + (f[7]! << 16) + (f[8]! << 8) + f[9]!;
    expect(len).toBe(70000);
  });
});
