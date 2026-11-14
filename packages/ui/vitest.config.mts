import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { type Page } from "playwright";
import { defineConfig } from "vitest/config";
import { type BrowserCommand } from "vitest/node";

const browserTests = ["src/**/*.browser.test.tsx"];

const emulateMedia: BrowserCommand<[Parameters<Page["emulateMedia"]>[0]]> = async (
  { page },
  media,
) => {
  await page.emulateMedia(media);
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          environment: "jsdom",
          exclude: ["**/node_modules/**", ...browserTests],
          name: "unit",
        },
      },
      {
        extends: true,
        test: {
          browser: {
            commands: { emulateMedia },
            enabled: true,
            headless: true,
            instances: [{ browser: "chromium" }],
            provider: playwright({ launchOptions: process.env.CI ? { channel: "chrome" } : {} }),
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
