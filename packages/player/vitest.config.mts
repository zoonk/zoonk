import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  plugins: [tsconfigPaths()],
  test: {
    deps: {
      optimizer: { ssr: { include: ["next"] } },
    },
    environment: "jsdom",
    server: {
      deps: {
        // https://github.com/vercel/next.js/issues/77200
        inline: ["next-intl"],
      },
    },
  },
});
