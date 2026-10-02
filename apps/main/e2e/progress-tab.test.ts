import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { studySessionBlockFixture } from "@zoonk/testing/fixtures/study-sessions";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { openAs } from "./study-day";

/** Ana's goal is named after the ENEM edition the seed picks for today: the year of her exam date. */
async function findPreparationTitle(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return `ENEM ${goal.targetDate?.getUTCFullYear()} preparation`;
}

const EXTRA = { equals: true, path: ["extra"] };

/** The day's bonus practice played out: the block "Practice now" added, then a second one. */
async function useUpBonusPractice(goalId: string) {
  const added = await prisma.studySessionBlock.findFirstOrThrow({
    orderBy: { createdAt: "desc" },
    where: { payload: EXTRA, session: { goalId } },
  });

  const last = await prisma.studySessionBlock.findFirstOrThrow({
    orderBy: { position: "desc" },
    where: { sessionId: added.sessionId },
  });

  await Promise.all([
    prisma.studySessionBlock.update({ data: { status: "completed" }, where: { id: added.id } }),
    studySessionBlockFixture({
      kind: "practice",
      payload: { areaId: "bonus-second", extra: true, itemIds: [], skillIds: [] },
      position: last.position + 1,
      sessionId: added.sessionId,
      status: "completed",
    }),
  ]);

  return added.sessionId;
}

/** A Focus learner with a learn goal on Progress and a quick explanation to switch to. */
async function createLearnAndExplainLearner() {
  const user = await createE2EUser(getBaseURL());

  const [learn, explain] = await Promise.all([
    goalFixture({ title: "Learn percentages", userId: user.id }),
    goalFixture({ kind: "explain", title: "Why the market is up 2%", userId: user.id }),
  ]);

  await Promise.all([
    planFixture({ goalId: learn.id }),
    planFixture({ goalId: explain.id }),
    learningProfileFixture({ activeGoalId: learn.id, experienceMode: "focus", userId: user.id }),
  ]);

  return { user };
}

/**
 * The Progress tab for Ana's ENEM goal: preparation with its evidence, the estimated score after
 * her mock, areas with what's still needed and practice on the weakest (two bonus blocks a day at
 * most), the week and the stats pages.
 * Fun draws the same numbers as the preparation ring and area planets. Goals without mock exams
 * count weekly challenges, and a quick explanation has nothing to prepare for.
 */
test.describe("Progress tab", () => {
  test("Focus shows preparation with its evidence and what's still needed by area, then practices the weakest up to the day's cap", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page, user }) => {
      const title = await findPreparationTitle(user.goalId);
      await page.goto("/progress");

      await expect(page.getByText(title)).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: /^\d+%$/u })).toBeVisible();

      await Promise.all(
        ["Coverage", "Mastery", "Long-term memory", "Mock exams"].map((part) =>
          expect(page.getByText(part, { exact: true })).toBeVisible(),
        ),
      );

      await expect(page.getByText(/^Estimated score: \d+% to \d+%$/u)).toBeVisible();
      await expect(page.getByText(/^Based on your last/u)).toBeVisible();
      await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();

      // Each area is listed once, with its preparation and what's still needed there.
      const stillNeeded = page.getByRole("region", { name: "Your areas" });
      await expect(stillNeeded.getByRole("heading", { name: "Your areas" })).toBeVisible();

      // An exam asks for Solid only where the topic weighs a lot.
      await expect(
        stillNeeded.getByText("The topics that weigh most need to be Solid; the rest, started."),
      ).toBeVisible();

      await expect(stillNeeded.getByText(/^\d+ skills? to go/u)).toBeVisible();
      await expect(stillNeeded.getByText(/^\d+ skills? left · about/u).first()).toBeVisible();
      await expect(stillNeeded.getByText(/^Next: /u).first()).toBeVisible();

      await page.getByRole("button", { name: "Practice now" }).click();

      // Practice plays on the session screen; with nothing left to practice, the area's lesson opens.
      await expect(page).toHaveURL(/\/(?:session|learn\/[0-9a-f-]+\?session=.+)$/u);

      // Bonus practice stops at two blocks a day: after both, the tap says so and adds none.
      const sessionId = await useUpBonusPractice(user.goalId);
      await page.goto("/progress");
      await page.getByRole("button", { name: "Practice now" }).click();

      await expect(
        page.getByRole("status").filter({ hasText: "That's all the bonus practice for today." }),
      ).toBeVisible();

      await expect(page).toHaveURL(/\/progress$/u);

      await expect(
        prisma.studySessionBlock.count({ where: { payload: EXTRA, sessionId } }),
      ).resolves.toBe(2);
    });
  });

  test("Fun shows the preparation ring, the stages and the areas as planets, with the stats and mistakes a tap away", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "fun", persona: "exam" }, async ({ page, user }) => {
      const title = await findPreparationTitle(user.goalId);
      await page.goto("/progress");

      await expect(page.getByRole("heading", { name: title })).toBeVisible();

      await expect(page.getByRole("list", { name: "Stages" }).getByRole("listitem")).toHaveText([
        "Warming up",
        "Getting there",
        "Solid",
      ]);

      await expect(page.getByText(/^Estimated \d+% to \d+%$/u)).toBeVisible();

      await expect(page.getByRole("region", { name: "You vs. plan" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Your areas" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Practice now" })).toBeVisible();
      await expectAccessibleScreen(page, "Progress");

      // The stats pages open inside the tabs.
      const stats = page.getByRole("navigation", { name: "Your stats" });
      await stats.getByRole("link", { name: "Energy" }).click();

      await expect(page).toHaveURL(/\/energy$/u);

      await expect(
        page
          .getByRole("navigation", { name: "Learning tabs" })
          .getByRole("link", { name: "Buddy" }),
      ).toHaveAttribute("aria-current", "page");

      await stats.getByRole("link", { name: "Progress" }).click();
      await expect(page).toHaveURL(/\/progress$/u);

      // The mistakes notebook is one tap from Progress.
      await page.getByRole("link", { name: /^Mistakes notebook/u }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: "Mistakes notebook" }),
      ).toBeVisible();
    });
  });

  test("a learn goal counts its weekly challenges, and a quick explanation has no preparation", async ({
    browser,
  }) => {
    const { user } = await createLearnAndExplainLearner();
    const page = await openAs(browser, user);

    await page.goto("/progress");

    await expect(page.getByText("Weekly challenges", { exact: true })).toBeVisible();
    await expect(page.getByText("Mock exams", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/^Estimated/u)).toHaveCount(0);

    await page.getByRole("button", { name: /Current goal: Learn percentages/u }).click();
    await page.getByRole("menuitemradio", { name: "Why the market is up 2%" }).click();

    await expect(
      page.getByText(
        "A quick explanation has nothing to prepare for. Its ideas come back in your reviews so they stay with you.",
      ),
    ).toBeVisible();

    await expect(page.getByText("Coverage", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Your stats" })).toBeVisible();
    await page.context().close();
  });
});
