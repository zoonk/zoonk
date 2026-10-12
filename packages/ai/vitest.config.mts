import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

/**
 * Test files that mock modules of their own (`vi.mock`, `vi.doMock`, `vi.unmock`): a mocked module
 * stays mocked in its worker, so these run in a fresh worker each. Every other file shares workers
 * and loads the AI SDKs once per worker instead of once per file.
 */
const OWN_MOCKS = globSync("src/**/*.test.ts", { cwd: import.meta.dirname }).filter((file) =>
  /\bvi\.(?:mock|doMock|unmock)\(/u.test(readFileSync(resolve(import.meta.dirname, file), "utf8")),
);

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          exclude: [...configDefaults.exclude, ...OWN_MOCKS],
          isolate: false,
          name: "shared",
        },
      },
      { extends: true, test: { include: OWN_MOCKS, name: "own-mocks" } },
    ],
  },
});
