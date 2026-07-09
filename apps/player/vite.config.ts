import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // In dev-loop A the devhost runs on 8787; proxy WS + join there.
      "/ws": { target: "ws://localhost:8787", ws: true },
    },
  },
  build: {
    target: "es2020",
    // One JS file + one CSS file keeps the embedded-asset map tiny.
    rollupOptions: {
      output: {
        manualChunks: undefined,
        entryFileNames: "assets/app.js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
