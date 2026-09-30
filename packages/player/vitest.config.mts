import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const nextImageShim = fileURLToPath(
  new URL("src/_test-utils/shims/next-image.tsx", import.meta.url),
);

const nextIntlShim = fileURLToPath(new URL("src/_test-utils/shims/next-intl.ts", import.meta.url));

const webHapticsShim = fileURLToPath(
  new URL("src/_test-utils/shims/web-haptics-react.ts", import.meta.url),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "next-intl": nextIntlShim,
      "next/image": nextImageShim,
      "web-haptics/react": webHapticsShim,
    },
    tsconfigPaths: true,
  },
  test: {
    deps: { optimizer: { ssr: { include: ["next"] } } },
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    server: {
      deps: {
        // https://github.com/vercel/next.js/issues/77200
        inline: ["next-intl"],
      },
    },
  },
});
