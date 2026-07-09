import type { StaticAsset } from "@familyquest/server-core";
import { playerAssets } from "../../assets/playerBundle";

/**
 * Turn the generated player bundle (gzipped, base64) into the asset map the
 * embedded server serves. Bodies stay gzipped — browsers decompress via
 * Content-Encoding — so the phone never even inflates them.
 */

function base64Decode(b64: string): Uint8Array {
  // atob is available on Hermes (RN 0.74+); fall back to a pure decode just in case.
  if (typeof atob === "function") {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = b64.replace(/=+$/, "");
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const value = ALPHABET.indexOf(ch);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

let cached: Map<string, StaticAsset> | null = null;

export function getEmbeddedAssets(): Map<string, StaticAsset> {
  if (cached) return cached;
  cached = new Map(
    Object.entries(playerAssets).map(([path, asset]) => [
      path,
      {
        contentType: asset.contentType,
        body: base64Decode(asset.gzB64),
        gzipped: true,
      },
    ]),
  );
  return cached;
}
