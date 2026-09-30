import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const browserTests = ["src/**/*.browser.test.tsx"];
const unitTests = ["src/**/*.test.ts", "src/**/*.test.tsx"];

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
    projects: [
      {
        extends: true,
        test: { environment: "jsdom", exclude: browserTests, include: unitTests, name: "unit" },
      },
      {
        extends: true,
        test: {
          // The player's screens played in a real browser: what learners see and do, in any app.
          browser: {
            enabled: true,
            headless: true,
            instances: [{ browser: "chromium", name: "chromium" }],
            // Playwright's matching: a name or text matches a substring unless `exact` is passed.
            locators: { exact: false },
            provider: playwright({ launchOptions: process.env.CI ? { channel: "chrome" } : {} }),
            // Playwright's Desktop Chrome size, which the apps' E2E runs use.
            viewport: { height: 720, width: 1280 },
          },
          include: browserTests,
          name: "browser",
          setupFiles: ["./src/_test-utils/browser-setup.ts"],
        },
      },
    ],
    server: {
      deps: {
        // https://github.com/vercel/next.js/issues/77200
        inline: ["next-intl"],
      },
    },
  },
});
