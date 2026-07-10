import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import type { StaticAsset } from "@familyquest/server-core";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

/** Load the built player SPA into memory, pre-gzipped. */
export function loadPlayerAssets(distDir: string): Map<string, StaticAsset> {
  const assets = new Map<string, StaticAsset>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const rel = "/" + relative(distDir, full).replaceAll("\\", "/");
      const ext = rel.slice(rel.lastIndexOf("."));
      assets.set(rel, {
        contentType: CONTENT_TYPES[ext] ?? "application/octet-stream",
        body: new Uint8Array(gzipSync(readFileSync(full), { level: 9 })),
        gzipped: true,
      });
    }
  };
  walk(distDir); // throws when the SPA isn't built — fail fast at boot
  return assets;
}
