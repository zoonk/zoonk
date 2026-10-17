import { type Page, type TestInfo, expect } from "@playwright/test";
import { settleAnimations } from "@zoonk/testing/accessibility/scan";

const PHONE_WIDTH = 390;
const DESKTOP_WIDTH = 1440;
const ANIMATION_WAIT_MS = 3000;

async function captureEnding(
  page: Page,
  testInfo: TestInfo,
  ending: string,
  width: number,
  colorScheme: "light" | "dark",
) {
  await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
  await page.setViewportSize({ height: 900, width });
  await expect.poll(() => page.evaluate(settleAnimations, ANIMATION_WAIT_MS)).toBe(0);

  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath(
      `${ending}-mission-ending-${width}${colorScheme === "dark" ? "-dark" : ""}.png`,
    ),
  });
}

/** Records the settled ending at phone and desktop widths in the parent's E2E artifacts. */
export async function captureMissionEnding(page: Page, testInfo: TestInfo, ending: string) {
  await captureEnding(page, testInfo, ending, PHONE_WIDTH, "light");
  await captureEnding(page, testInfo, ending, PHONE_WIDTH, "dark");
  await captureEnding(page, testInfo, ending, DESKTOP_WIDTH, "light");
  await captureEnding(page, testInfo, ending, DESKTOP_WIDTH, "dark");
  await page.emulateMedia({ colorScheme: "light" });
}
