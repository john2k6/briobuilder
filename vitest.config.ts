import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      include: ["src/lib/track-engine/**"],
      exclude: ["**/*.test.ts", "**/index.ts", "**/types.ts"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
