import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // See test/stubs/server-only.ts — the real package is a bundler marker
      // with no Node entry point.
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    env: {
      // Rate-limit assertions drive the limiter directly; the global kill
      // switch would make them meaningless.
      RATE_LIMIT_DISABLED: "false",
    },
  },
});
