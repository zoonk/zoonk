import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { type Page, expect, test } from "./fixtures";
import { createCheckpointLearner, playDuel, starShownAt } from "./fun-rewards-fixtures";
import { openAs } from "./study-day";

/** The boss as today's session opens it, so it continues back to the session. */
function openSessionBoss(page: Page, block: { id: string; sessionId: string }) {
  return page.goto(`/checkpoint/${block.id}?session=${block.sessionId}`);
}

test.describe("Ceremonies", () => {
  test("Fun: the first boss's glasses get one skippable ceremony at the end of the session", async ({
    browser,
  }) => {
    const { block, user } = await createCheckpointLearner({ mode: "fun" });
    const page = await openAs(browser, user);

    await openSessionBoss(page, block);
    await page.getByRole("button", { name: "Take it on" }).click();
    await playDuel(page);
    await page.getByRole("link", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/session$/u);

    const ceremony = page.getByRole("dialog", { name: "Star glasses!" });
    await expect(ceremony).toBeVisible();
    await expect(ceremony.getByText("For beating your first boss.")).toBeVisible();

    await ceremony.getByRole("button", { name: "Skip" }).click();

    await expect(ceremony).toBeHidden();
    await expect.poll(() => starShownAt(user.id)).not.toBeNull();

    await page.reload();
    await expect(page.getByRole("dialog", { name: "Star glasses!" })).toHaveCount(0);

    await page.context().close();
  });

  test("Focus: the same checkpoint and milestone land quietly, with no overlay", async ({
    browser,
  }) => {
    const { block, user } = await createCheckpointLearner({ mode: "focus" });
    const page = await openAs(browser, user);

    await openSessionBoss(page, block);

    await expect(page.getByText("Phase 1 checkpoint")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Basics" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The Trickster" })).toHaveCount(0);
    await expectAccessibleScreen(page, "the checkpoint's intro");

    await page.getByRole("button", { name: "Start" }).click();
    await playDuel(page);
    await expect(page.getByRole("heading", { name: "Checkpoint passed" })).toBeVisible();
    await page.getByRole("link", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/session$/u);

    await expect(page.getByText("First phase checkpoint passed")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => starShownAt(user.id)).not.toBeNull();

    await page.context().close();
  });
});
