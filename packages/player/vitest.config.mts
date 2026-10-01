import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { type Page } from "playwright";
import { defineConfig } from "vitest/config";
import { type BrowserCommand } from "vitest/node";

const browserTests = ["src/**/*.browser.test.tsx"];
const unitTests = ["src/**/*.test.ts", "src/**/*.test.tsx"];

/** What only a finger does (hold to drag, swipe to scroll), played on a phone's touch screen. */
const touchTests = ["src/**/*.touch.browser.test.tsx"];

const launchOptions = process.env.CI ? { channel: "chrome" } : {};

const nextImageShim = fileURLToPath(
  new URL("src/_test-utils/shims/next-image.tsx", import.meta.url),
);

const nextIntlShim = fileURLToPath(new URL("src/_test-utils/shims/next-intl.ts", import.meta.url));

const webHapticsShim = fileURLToPath(
  new URL("src/_test-utils/shims/web-haptics-react.ts", import.meta.url),
);

/**
 * Sets the device's light or dark scheme and its reduced-motion setting, which a page can only
 * read. Typed for tests in `src/_test-utils/device-media.ts`.
 */
const emulateMedia: BrowserCommand<[Parameters<Page["emulateMedia"]>[0]]> = async (
  { page },
  media,
) => {
  await page.emulateMedia(media);
};

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
            commands: { emulateMedia },
            enabled: true,
            headless: true,
            instances: [
              { browser: "chromium", exclude: touchTests, name: "chromium" },
              {
                browser: "chromium",
                include: touchTests,
                name: "chromium-touch",
                // A touch screen without `isMobile`, whose layout viewport would scale the frame.
                provider: playwright({ contextOptions: { hasTouch: true }, launchOptions }),
                viewport: { height: 812, width: 375 },
              },
            ],
            // Playwright's matching: a name or text matches a substring unless `exact` is passed.
            locators: { exact: false },
            provider: playwright({ launchOptions }),
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
