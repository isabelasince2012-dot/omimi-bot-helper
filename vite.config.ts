// @lovable.dev/vite-tanstack-config already includes tanstackStart, viteReact,
// tailwindcss, tsConfigPaths, nitro, etc. — do NOT add them manually.
// Inside Lovable's build the preset is forced to Cloudflare; the `preset`
// override below applies only when building outside Lovable (Render/Railway/etc.).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (SSR error wrapper).
    server: { entry: "server" },
  },
  nitro: {
    // Node.js server output at .output/server/index.mjs — run with `node .output/server/index.mjs`.
    // Works on Render, Railway, Fly, Docker, or any Node 20+ host.
    preset: "node-server",
  },
});
