import { resolve } from "node:path";
import { getTestEnvironment } from "@zoonk/db/test-environment";
import { defineConfig } from "vitest/config";

export default defineConfig({
  assetsInclude: ["**/*.md"],
  resolve: {
    alias: { "server-only": resolve(import.meta.dirname, "__mocks__/server-only.ts") },
    tsconfigPaths: true,
  },
  test: {
    env: { ...getTestEnvironment("test"), NEXT_PUBLIC_APP_DOMAIN: "localhost:9000" },
    environment: "node",
    globalSetup: ["./vitest.global-setup.ts"],
    // Every worker opens up to 10 connections to the one test database (node-postgres' pool), and
    // fixtures create rows in parallel, so one worker per core overflows Postgres' default 100.
    maxWorkers: 6,
    setupFiles: ["./setup-tests.ts"],
  },
});
