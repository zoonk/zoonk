import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    deps: {
      optimizer: {
        ssr: {
          include: ["next"],
        },
      },
    },
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
