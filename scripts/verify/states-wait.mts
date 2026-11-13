/* oxlint-disable no-await-in-loop -- Wait for consecutive layout observations in one page. */
import { type Page } from "@playwright/test";
import { compareLayout, snapshotLayout } from "./states-probe.mts";

const TRANSITION_CAP_MS = 800;
const STILL_MS = 500;
const STILL_TRIES = 8;

export async function settle(page: Page, ms: number) {
  await page.waitForTimeout(ms);

  await page.evaluate(
    async (cap) =>
      Promise.race([
        Promise.all(
          document
            .getAnimations()
            .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
            .map(async (animation) => animation.finished.catch(() => null)),
        ),
        new Promise((resolve) => {
          setTimeout(resolve, cap);
        }),
      ]),
    TRANSITION_CAP_MS,
  );
}

export async function holdStill(page: Page) {
  for (let tries = 0; tries < STILL_TRIES; tries += 1) {
    await page.evaluate(snapshotLayout);
    await page.waitForTimeout(STILL_MS);

    const { moved: changed } = await page.evaluate(compareLayout, "");

    if (changed.length === 0) {
      return;
    }
  }
}
