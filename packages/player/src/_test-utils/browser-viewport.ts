import { page } from "vitest/browser";

/** The browser tests' own size (`viewport` in vitest.config.mts), which every test starts at. */
const HARNESS_VIEWPORT = { height: 720, width: 1280 };

/** Plays at `size`, then puts the harness back at its own size for the next test. */
export async function atViewport(
  size: { height: number; width: number },
  play: () => Promise<void>,
) {
  await page.viewport(size.width, size.height);

  try {
    await play();
  } finally {
    await page.viewport(HARNESS_VIEWPORT.width, HARNESS_VIEWPORT.height);
  }
}
