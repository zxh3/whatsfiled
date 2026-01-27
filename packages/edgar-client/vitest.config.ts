import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/internal/form4/raw-types.ts"],
      thresholds: {
        lines: 75,
        functions: 65,
        branches: 70,
        statements: 75,
      },
    },
  },
});
