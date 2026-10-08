import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { createCeremonyLearner } from "./ceremony-fixtures";
import { type Page, expect, test } from "./fixtures";
import { continueToLastStep } from "./result-steps";
import { openAs } from "./study-day";

/**
 * Opens the day's summary and goes through its steps to the last, where the moment opens (at once
 * when the summary has one step).
 */
async function openSummaryEnd(page: Page) {
  await page.goto("/session");

  const summary = page.getByRole("heading", { level: 1, name: "Session complete" });
  await expect(summary.or(page.getByRole("dialog")).first()).toBeVisible();
  await continueToLastStep(page);
}

async function readShownAt(milestoneId: string) {
  const milestone = await prisma.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
  return milestone.shownAt;
}

async function readGlasses(userId: string) {
  const profile = await prisma.userLearningProfile.findUniqueOrThrow({ where: { userId } });
  return profile.buddyGlasses;
}

test.describe("Ceremonies", () => {
  test("new glasses get one full-screen moment at the summary's last step: Skip closes it and it never repeats", async ({
    browser,
  }) => {
    const { milestone, user } = await createCeremonyLearner({ key: "star", kind: "glasses" });
    const page = await openAs(browser, user);

    await openSummaryEnd(page);

    const ceremony = page.getByRole("dialog", { name: "Star glasses!" });

    await expect(ceremony).toBeVisible();
    await expect(ceremony.getByText("For winning your first phase challenge.")).toBeVisible();
    await expect(ceremony.getByRole("img", { name: "Zu" })).toBeVisible();
    await expect(ceremony.getByRole("button", { name: "Wear them" })).toBeFocused();
    await expectAccessibleScreen(page, "the glasses ceremony");

    await ceremony.getByRole("button", { name: "Skip" }).click();

    await expect(ceremony).toBeHidden();
    await expect.poll(() => readShownAt(milestone.id)).not.toBeNull();
    await expect.poll(() => readGlasses(user.id)).toBe("round");

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Session complete" })).toBeVisible();
    await continueToLastStep(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.context().close();
  });

  test("Enter wears the new glasses right away", async ({ browser }) => {
    const { user } = await createCeremonyLearner({ key: "star", kind: "glasses" });
    const page = await openAs(browser, user);

    await openSummaryEnd(page);

    const ceremony = page.getByRole("dialog", { name: "Star glasses!" });
    await expect(ceremony.getByRole("button", { name: "Wear them" })).toBeFocused();

    await page.keyboard.press("Enter");

    await expect(ceremony).toBeHidden();
    await expect.poll(() => readGlasses(user.id)).toBe("star");

    await page.context().close();
  });

  test("a new belt gets its moment with one button to continue", async ({ browser }) => {
    const { milestone, user } = await createCeremonyLearner({ key: "orange", kind: "belt" });
    const page = await openAs(browser, user);

    await openSummaryEnd(page);

    const ceremony = page.getByRole("dialog", { name: "Orange belt!" });

    await expect(ceremony.getByText("Every point came from what you learned.")).toBeVisible();
    await ceremony.getByRole("button", { name: "Continue" }).click();

    // The step under it takes the focus, so the summary reads on from there.
    await expect(ceremony).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Session complete" })).toBeFocused();
    await expect.poll(() => readShownAt(milestone.id)).not.toBeNull();

    await page.context().close();
  });
});
