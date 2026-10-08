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
import { openAs } from "./study-day";

/**
 * The plan's waits move on by themselves: a stand-in for a lesson still being written turns into
 * its chapter once its outline lands, without a refresh, and an own-words edit that hangs says so.
 */

/** Stand-ins are read again every 10 seconds while lessons are being written. */
const WRITING_REFRESH_MS = 10_000;

/** A learner whose active goal has a plan. */
async function createPlanLearner() {
  const user = await createE2EUser(getBaseURL());

  const goal = await goalFixture({
    timezone: "UTC",
    title: `Ratios ${randomUUID().slice(0, 6)}`,
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

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
  test("the lesson being written turns into its chapter on the Journey on its own", async ({
    browser,
  }) => {
    const { goal, user } = await createPlanLearner();
    const { chapter, landOutline } = await createPlanBeingWritten(goal.id);

    const page = await openAs(browser, user);
    await page.clock.install();
    await page.goto("/journey");

    // The phase the learner is in is open, with the lessons still being written in it.
    const path = page.getByRole("list", { name: "Your journey" });
    await expect(path.getByText("Lessons on the way")).toBeVisible();
    await expect(path.getByRole("link")).toHaveCount(0);

    // The outline lands; the plan's next read, without a refresh, shows its chapter.
    await landOutline();
    await page.clock.fastForward(WRITING_REFRESH_MS);

    await expect(path.getByRole("link", { name: new RegExp(chapter.title, "u") })).toHaveAttribute(
      "href",
      `/content/chapters/${chapter.id}`,
    );

    await expect(path.getByText("Lessons on the way")).toBeHidden();
    await page.context().close();
  });
});
