import { type Browser } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { createModeLearner } from "./fun-rewards-fixtures";
import { type Mode, asPersona } from "./learn-personas";

const FADED_DAYS = 30;
const QUESTIONS_PER_SKILL = 3;

/**
 * A learner refreshing statistics they studied a month ago: two skills, both fading, with
 * questions enough for today's reviews and a refresh on top.
 */
async function createRefreshLearner({ browser, mode }: { browser: Browser; mode: Mode }) {
  const { goal, user } = await createModeLearner(mode);

  const [plan, chapter, skills] = await Promise.all([
    planFixture({ goalId: goal.id, phases: [{ name: "Averages" }] }),
    libraryChapterFixture({ title: "Averages" }),
    Promise.all(["Mean", "Median"].map((name) => skillFixture({ name }))),
  ]);

  await Promise.all([
    prisma.goal.update({ data: { details: { purpose: "refresh" } }, where: { id: goal.id } }),
    ...skills.map((skill, position) =>
      planItemFixture({ chapterId: chapter.id, planId: plan.id, position, skillId: skill.id }),
    ),
    ...skills.flatMap((skill) =>
      Array.from({ length: QUESTIONS_PER_SKILL }, (_, index) =>
        itemFixture({
          content: choiceItemContent(`${skill.name} ${index + 1}?`),
          skillId: skill.id,
        }),
      ),
    ),
    ...skills.map((skill) =>
      learnerSkillFixture({
        difficulty: 5,
        lastReviewedAt: new Date(Date.now() - FADED_DAYS * MS_PER_DAY),
        reps: 2,
        skillId: skill.id,
        stability: 2,
        state: "learning",
        userId: user.id,
      }),
    ),
  ]);

  const context = await browser.newContext({ storageState: user.storageState });
  return { context, page: await context.newPage() };
}

/**
 * The map of the subject: Maya's huge quantum physics goal drawn from its skill graph (only the
 * phase she's in open), refresh mode for a learner whose skills are fading, and what to study next
 * once Lucas has finished his overview.
 */
test.describe("Map of the subject", () => {
  test("opens from Content with only the current phase open", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "hugeGoal" }, async ({ page }) => {
      await page.goto("/content");
      await page.getByRole("link", { name: /Map of your subject/u }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: "Map of your subject" }),
      ).toBeVisible();

      const phases = page.getByRole("list", { name: "Phases" });
      const current = phases.getByRole("button", { name: /Phase 1: The math physics uses/u });
      const later = phases.getByRole("button", { name: /Phase 2: Calculus and linear algebra/u });

      await expect(current).toHaveAttribute("aria-expanded", "true");
      await expect(later).toHaveAttribute("aria-expanded", "false");
      await expect(phases.getByText("You are here", { exact: true })).toBeVisible();
      await expectAccessibleScreen(page, "the map of the subject");

      const chapterMap = page.getByRole("list", {
        name: "Skills in Exponents and scientific notation",
      });

      await chapterMap.getByRole("button", { name: /^Use powers of ten/u }).click();

      const detail = page.getByRole("region", { name: "Use powers of ten" });
      await expect(detail.getByText(/10ⁿ is 1 followed by n zeros/u)).toBeVisible();

      await detail.getByRole("link", { name: "Open chapter" }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: "Exponents and scientific notation" }),
      ).toBeVisible();
    });
  });

  test("leads with fading skills for a refresh goal", async ({ browser }) => {
    const { context, page } = await createRefreshLearner({ browser, mode: "fun" });

    try {
      await page.goto("/content/map");

      const refresh = page.getByRole("region", { name: "2 skills are fading" });
      await expect(refresh.getByText("Mean")).toBeVisible();

      await refresh.getByRole("button", { name: "Refresh now" }).click();
      await expect(page).toHaveURL(/\/session$/u);
    } finally {
      await context.close();
    }
  });

  test("continues at the next level once the plan is done", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "fun" }, async ({ page, user }) => {
      await prisma.planItem.updateMany({
        data: { status: "done" },
        where: { kind: { in: ["chapter", "lesson"] }, plan: { goalId: user.goalId } },
      });

      await page.goto("/plan");
      await expect(page.getByRole("heading", { name: "You finished this plan" })).toBeVisible();

      await page.getByRole("link", { name: "What to study next" }).click();

      const next = page.getByRole("region", { name: "You finished your plan" });
      await expect(next).toBeVisible();

      await next.getByRole("button", { name: "Continue at Beginner" }).click();
      await expect(page).toHaveURL(/\/plan$/u);

      await expect
        .poll(async () => {
          const goals = await prisma.goal.findMany({
            orderBy: { createdAt: "asc" },
            select: { status: true },
            where: { userId: user.id },
          });

          return goals.map((goal) => goal.status);
        })
        .toStrictEqual(["completed", "active"]);

      await expect(page.getByRole("heading", { name: "Building your plan" })).toBeVisible();
    });
  });
});
