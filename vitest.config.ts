import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the "paths" entry in tsconfig.json so tests import modules the
      // same way the app does.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // e2e/ is Playwright's; running it under Vitest would fail confusingly.
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
});
