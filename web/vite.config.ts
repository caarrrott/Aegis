import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const api = "http://localhost:8000";

/**
 * The source lives in `web/app`. The build writes one self-contained
 * `web/dist/index.html`, which a small post-build step copies to
 * `web/index.html` — the file the existing FastAPI route already serves.
 */
export default defineConfig({
  root: "app",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    cssCodeSplit: false,
  },
  server: {
    port: 5173,
    proxy: {
      "/ask": api,
      "/documents": api,
      "/health": api,
    },
  },
});
