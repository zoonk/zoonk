import { type Locator } from "@playwright/test";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";
import { createModeLearner } from "./fun-rewards-fixtures";
import { openAs } from "./study-day";

const SIZES = {
  desktop: { height: 800, width: 1280 },
  phone: { height: 812, width: 375 },
} as const;

type Box = { height: number; width: number; x: number; y: number };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("Expected a visible element");
  }

  return box;
}

function overlaps(first: Box, second: Box): boolean {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}

/** Where the buddy and the paper sit on the screen. */
async function companionLayout(page: Page) {
  const [paper, buddy] = await Promise.all([
    boxOf(page.locator('[data-slot="fun-paper"]')),
    boxOf(page.locator('[data-slot="fun-companion"] [data-slot="buddy"]')),
  ]);

  return { buddy, paper };
}

test.describe("Lesson buddy", () => {
  for (const [size, viewport] of Object.entries(SIZES)) {
    test(`Fun on a ${size}: the buddy and its line have their own space, off the paper`, async ({
      browser,
    }) => {
      const [{ user }, { lesson }] = await Promise.all([
        createModeLearner("fun"),
        playableLessonFixture({ steps: ["hook", "explanation"] }),
      ]);

      const page = await openAs(browser, user);
      await page.setViewportSize(viewport);
      await page.goto(`/learn/${lesson.id}`);

      // Each line is announced politely, from a region that stays on the page between lines.
      const line = page.locator('[aria-live="polite"] [data-slot="buddy-speech"]');
      await expect(line).toBeVisible();
      await expect(line).toHaveText("Ready when you are.");

      const speaking = await companionLayout(page);
      const lineBox = await boxOf(line);

      expect(overlaps(lineBox, speaking.paper)).toBe(false);
      expect(overlaps(speaking.buddy, speaking.paper)).toBe(false);

      // Above the paper on phones; beside it on desktop, where the paper keeps the center column.
      const lineEnd = size === "phone" ? lineBox.y + lineBox.height : lineBox.x + lineBox.width;
      const paperStart = size === "phone" ? speaking.paper.y : speaking.paper.x;
      expect(lineEnd).toBeLessThanOrEqual(paperStart);

      await page.getByRole("radio", { name: "No" }).click();
      await page.getByRole("button", { name: /^See the answer/u }).click();
      await expect(line).toHaveText("Nice one!");
      await page.getByRole("button", { name: /^Continue/u }).click();

      // While the learner reads, the buddy is quiet in the same spot: its lines never move the paper.
      await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
      await expect(line).toHaveCount(0);

      const quiet = await companionLayout(page);

      expect(quiet.paper.x - quiet.buddy.x).toBe(speaking.paper.x - speaking.buddy.x);
      expect(quiet.paper.y - quiet.buddy.y).toBe(speaking.paper.y - speaking.buddy.y);
      await page.context().close();
    });
  }

  test("Focus: the same lesson without a buddy", async ({ browser }) => {
    const [{ user }, { lesson }] = await Promise.all([
      createModeLearner("focus"),
      playableLessonFixture(),
    ]);

    const page = await openAs(browser, user);

    await page.goto(`/learn/${lesson.id}`);

    await expect(page.getByText("Guess first · no points")).toBeVisible();
    await expect(page.getByText("Ready when you are.")).toHaveCount(0);
    await page.context().close();
  });
});
