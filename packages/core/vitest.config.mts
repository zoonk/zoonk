import { resolve } from "node:path";
import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  assetsInclude: ["**/*.md"],
  plugins: [tsconfigPaths()],
  resolve: {
    // Use @zoonk/auth/testing in tests to avoid nextCookies() which requires Next.js context
    alias: [
      {
        find: /^@zoonk\/auth$/,
        replacement: resolve(__dirname, "../auth/src/testing.ts"),
      },
    ],
  },
  test: {
    env: loadEnv("test", process.cwd(), ""),
    environment: "node",
    globalSetup: ["./prisma-test-setup.ts"],
    setupFiles: ["./setup-tests.ts"],
  },
});
