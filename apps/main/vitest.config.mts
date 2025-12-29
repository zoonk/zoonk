import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  assetsInclude: ["**/*.md"],
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: [
      {
        // Use @zoonk/auth/testing in tests to avoid nextCookies() which requires Next.js context
        find: /^@zoonk\/auth$/,
        replacement: resolve(__dirname, "../../packages/auth/src/testing.ts"),
      },
    ],
  },
  test: {
    deps: {
      optimizer: { ssr: { include: ["next"] } },
    },
    env: loadEnv("test", process.cwd(), ""),
    environment: "jsdom",
    server: {
      deps: {
        // https://github.com/vercel/next.js/issues/77200
        inline: ["next-intl"],
      },
    },
    setupFiles: "./setup-tests.ts",
  },
});
