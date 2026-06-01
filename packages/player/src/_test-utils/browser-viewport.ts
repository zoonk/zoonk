import { page } from "vitest/browser";

const DEFAULT_DESKTOP_VIEWPORT = { height: 720, width: 1280 };
const MOBILE_PLAYER_VIEWPORT = { height: 844, width: 390 };

/**
 * Mobile player controls are intentionally hidden at desktop breakpoints. This
 * helper makes bottom-bar tests run at a phone-sized viewport, then restores a
 * desktop viewport so later browser tests keep their default layout assumptions.
 */
export async function runInMobilePlayerViewport(run: () => Promise<void>) {
  await page.viewport(MOBILE_PLAYER_VIEWPORT.width, MOBILE_PLAYER_VIEWPORT.height);

  try {
    await run();
  } finally {
    await page.viewport(DEFAULT_DESKTOP_VIEWPORT.width, DEFAULT_DESKTOP_VIEWPORT.height);
  }
}
