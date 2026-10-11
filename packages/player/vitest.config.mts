import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { durationSequencer } from "@zoonk/testing/vitest/duration-sequencer";
import { type CDPSession, type Page } from "playwright";
import { defineConfig } from "vitest/config";
import { type BrowserCommand } from "vitest/node";
import durations from "./vitest.durations.json" with { type: "json" };

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

/**
 * One touch event of a finger, `waitMs` after the one before when given. `at` (ms since the epoch)
 * is when the finger did it; without it, it's when the browser gets the event.
 */
type TouchStep = {
  at?: number;
  touchPoints: { x: number; y: number }[];
  type: "touchEnd" | "touchMove" | "touchStart";
  waitMs?: number;
};

const touchSessions = new WeakMap<Page, Promise<CDPSession>>();

/**
 * Plays a finger's touches through the browser's own touch input, all in one call: sent one at a
 * time from the test, each touch took a round trip to the driver, and a screen's swipes took
 * seconds. Typed for tests in `src/_test-utils/touch-screen.ts`.
 */
const touch: BrowserCommand<[TouchStep[]]> = async ({ page }, steps) => {
  const opening = touchSessions.get(page) ?? page.context().newCDPSession(page);
  touchSessions.set(page, opening);
  const session = await opening;

  for (const { at, touchPoints, type, waitMs = 0 } of steps) {
    if (waitMs > 0) {
      // oxlint-disable-next-line no-await-in-loop -- The finger rests before its next touch.
      await new Promise((resolve) => {
        setTimeout(resolve, waitMs);
      });
    }

    // oxlint-disable-next-line no-await-in-loop -- A finger's touches reach the page in order.
    await session.send("Input.dispatchTouchEvent", {
      touchPoints,
      type,
      ...(at === undefined ? {} : { timestamp: at / 1000 }),
    });
  }
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
        test: { environment: "node", exclude: browserTests, include: unitTests, name: "unit" },
      },
      {
        extends: true,
        test: {
          // The player's screens played in a real browser: what learners see and do, in any app.
          browser: {
            commands: { emulateMedia, touch },
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
    sequence: { sequencer: durationSequencer(durations) },
    server: {
      deps: {
        // https://github.com/vercel/next.js/issues/77200
        inline: ["next-intl"],
      },
    },
  },
});
