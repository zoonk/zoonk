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

const touchTests = ["src/**/*.touch.browser.test.tsx"];

const launchOptions = process.env.CI ? { channel: "chrome" } : {};

const nextImageShim = fileURLToPath(
  new URL("src/_test-utils/shims/next-image.tsx", import.meta.url),
);

const webHapticsShim = fileURLToPath(
  new URL("src/_test-utils/shims/web-haptics-react.ts", import.meta.url),
);

const emulateMedia: BrowserCommand<[Parameters<Page["emulateMedia"]>[0]]> = async (
  { page },
  media,
) => {
  await page.emulateMedia(media);
};

type TouchStep = {
  at?: number;
  touchPoints: { x: number; y: number }[];
  type: "touchEnd" | "touchMove" | "touchStart";
  waitMs?: number;
};

const touchSessions = new WeakMap<Page, Promise<CDPSession>>();

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
  // Discovering a dependency mid-test makes Vite reload the page; prebundle lazy imports too.
  optimizeDeps: {
    include: [
      "@streamdown/math",
      "@streamdown/mermaid",
      "@zoonk/ui > @base-ui/react/alert-dialog",
      "katex",
      "streamdown",
    ],
  },
  plugins: [react()],
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
            locators: { exact: false },
            provider: playwright({ launchOptions }),
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
