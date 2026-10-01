import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { createStudyDay, openAs } from "./study-day";

/**
 * The plan's waits move on by themselves: stand-ins for lessons still being written turn into their
 * chapter once its outline lands, without a refresh, and an own-words edit that hangs says so.
 */

/** Stand-ins are read again every 10 seconds while lessons are being written. */
const WRITING_REFRESH_MS = 10_000;

/** A Focus learner whose active goal has a plan. */
async function createPlanLearner() {
  const user = await createE2EUser(getBaseURL());

  const goal = await goalFixture({
    timezone: "UTC",
    title: `Ratios ${randomUUID().slice(0, 6)}`,
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: goal.id, experienceMode: "focus", userId: user.id });

  return { goal, user };
}

/**
 * A plan whose first lessons stand in for a skill until its outline lands (no lesson, no chapter),
 * scheduled today, and the outline that lands for them.
 */
async function createPlanBeingWritten(goalId: string) {
  const suffix = randomUUID().slice(0, 6);

  const [plan, skill, chapter, lesson] = await Promise.all([
    planFixture({ goalId }),
    skillFixture({ name: `Unit rates ${suffix}` }),
    libraryChapterFixture({ title: `Rates and ratios ${suffix}` }),
    libraryLessonFixture({ title: `What a unit rate is ${suffix}` }),
  ]);

  const standIn = await planItemFixture({
    planId: plan.id,
    scheduledFor: toUTCMidnight(new Date()),
    skillId: skill.id,
    titleSnapshot: "",
  });

  /** The outline lands the way the API's run writes it: the stand-in gets its lesson and chapter. */
  const landOutline = () =>
    prisma.planItem.update({
      data: { chapterId: chapter.id, lessonId: lesson.id, titleSnapshot: lesson.title },
      where: { id: standIn.id },
    });

  return { chapter, landOutline };
}

test.describe("Lessons being written in the plan", () => {
  test("a chapter being written turns into its chapter on its own", async ({ browser }) => {
    const { goal, user } = await createPlanLearner();
    const { chapter, landOutline } = await createPlanBeingWritten(goal.id);

    const page = await openAs(browser, user);
    await page.clock.install();
    await page.goto("/plan");

    await expect(page.getByText("Lessons being written")).toBeVisible();

    // The outline lands; the plan's next read, without a refresh, shows its chapter.
    await landOutline();
    await page.clock.fastForward(WRITING_REFRESH_MS);

    await expect(page.getByRole("link", { exact: true, name: chapter.title })).toBeVisible();
    await expect(page.getByText("Lessons being written")).toBeHidden();
    await page.context().close();
  });
});

/** An own-words edit waits this long before saying it's slow, and stops waiting after this long. */
const EDIT_SLOW_MS = 8000;
const EDIT_TIME_LIMIT_MS = 45_000;

test.describe("An own-words plan edit that hangs", () => {
  test("says so, then lets the learner try again", async ({ browser }) => {
    const { user } = await createStudyDay({ mode: "fun" });
    const page = await openAs(browser, user);
    const { promise: hung } = Promise.withResolvers<null>();

    // The edit's Server Action never answers, as when the server is stuck.
    await page.route(
      (url) => url.pathname.endsWith("/plan"),
      async (route) => {
        if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
          await hung;
        }

        await route.fallback();
      },
    );

    await page.clock.install();
    await page.goto("/plan");

    await page.getByRole("button", { name: "Change your plan" }).click();
    await page.getByLabel("Change it in your own words").fill("Less on weekends");
    await page.getByRole("button", { name: "Change my plan" }).click();
    await expect(page.getByRole("button", { name: "Changing…" })).toBeVisible();
    await page.clock.fastForward(EDIT_SLOW_MS + 1000);

    await expect(
      page.getByText("Still changing your plan. This is taking longer than usual."),
    ).toBeVisible();

    await page.clock.fastForward(EDIT_TIME_LIMIT_MS);

    await expect(
      page.getByText("This took too long. If your plan doesn't change in a moment, try again."),
    ).toBeVisible();

    // What they wrote stays, and the button sends it again.
    await expect(page.getByLabel("Change it in your own words")).toHaveValue("Less on weekends");
    await expect(page.getByRole("button", { name: "Change my plan" })).toBeEnabled();
    await page.context().close();
  });
});
