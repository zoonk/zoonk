import { page } from "vitest/browser";

const HARNESS_VIEWPORT = { height: 720, width: 1280 };

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
