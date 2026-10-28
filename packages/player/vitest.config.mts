import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { assertBrowserLaunchAllowed } from "@zoonk/testing/browser-preflight";
import { type CDPSession, type Page } from "playwright";
import { defineConfig } from "vitest/config";
import { type BrowserCommand } from "vitest/node";

assertBrowserLaunchAllowed();

const browserTests = ["src/**/*.browser.test.tsx"];
const unitTests = ["src/**/*.test.ts", "src/**/*.test.tsx"];

/** What only a finger does (hold to drag, swipe to scroll), played on a phone's touch screen. */
const touchTests = ["src/**/*.touch.browser.test.tsx"];

const launchOptions = process.env.CI ? { channel: "chrome" } : {};

const nextImageShim = fileURLToPath(
  new URL("src/_test-utils/shims/next-image.tsx", import.meta.url),
);

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

const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;

/** A cookie-protected JSON endpoint, like Main's session read, without an auth server or database. */
const sandboxSession: BrowserCommand<["start" | "stop"]> = async ({ page }, action) => {
  const url = new URL("/__sandbox-session.json", page.url()).href;

  if (action === "stop") {
    await page.context().clearCookies({ name: "sandbox-session" });
    return url;
  }

  await page
    .context()
    .addCookies([
      { httpOnly: true, name: "sandbox-session", sameSite: "Lax", url, value: "signed-in" },
    ]);

  return url;
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
  /**
   * Dependencies only code loaded on demand imports (the tutor's Markdown, KaTeX): bundled up
   * front, since one found mid-run makes Vite reload the page under a test.
   */
  optimizeDeps: {
    include: [
      "@streamdown/math",
      "@streamdown/mermaid",
      "@zoonk/ui > @base-ui/react/alert-dialog",
      "katex",
      "streamdown",
    ],
  },
  plugins: [
    react(),
    {
      configureServer(server) {
        // A real response lets every engine apply its own cookie and CORS rules.
        server.middlewares.use((request, response, next) => {
          if (request.url !== "/__sandbox-session.json") {
            next();
            return;
          }

          const cookie = request.headers.cookie ?? "";
          const signedIn = cookie.includes("sandbox-session=signed-in");

          response.writeHead(signedIn ? HTTP_OK : HTTP_UNAUTHORIZED, {
            "Content-Type": "application/json",
          });

          response.end(
            JSON.stringify(signedIn ? { token: "private-session-token" } : { error: "signed out" }),
          );
        });
      },
      name: "sandbox-session-fixture",
    },
  ],
  resolve: {
    alias: { "next/image": nextImageShim, "web-haptics/react": webHapticsShim },
    tsconfigPaths: true,
  },
  test: {
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
            commands: { emulateMedia, sandboxSession, touch },
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
  },
});
