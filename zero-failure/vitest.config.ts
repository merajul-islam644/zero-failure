// Vitest config. Node environment for engine tests; component tests opt into
// jsdom via per-file docblock (@vitest-environment jsdom).

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // One atomic fake RAF timeline shared per test file via globalThis.
    unstubEnvs: true,
    unstubGlobals: true
  }
});
