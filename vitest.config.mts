import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Le générateur explore des milliers de circuits : plus lent pendant la mesure de couverture.
    testTimeout: 30000,
    coverage: {
      include: ["src/lib/track-engine/**"],
      exclude: ["**/*.test.ts", "**/index.ts", "**/types.ts"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
