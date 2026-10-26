import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { expectHydrated } from "./hydration";
import { carryLessons, openAs } from "./study-day";

const DAYS_PER_WEEK = 7;

test.describe("Today without a session to start", () => {
  // Will's plan had Sunday off, and Will wanted to study anyway: Today showed only "Study for 10
  // minutes", which gave practice instead of the plan's next lessons, as if none were left.
  test("Keep learning on a rest day adds the plan's next lessons, those earlier days left first, and opens the first", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const goal = await goalFixture({ dailyMinutes: 10, timezone: "UTC", userId: user.id });
    const today = toUTCMidnight(new Date());

    // The plan gives today no time, and every other day its 10 minutes.
    const weekdayMinutes = Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
      weekday === today.getUTCDay() ? 0 : goal.dailyMinutes,
    );

    const [plan, session, upcoming] = await Promise.all([
      planFixture({ goalId: goal.id, settings: { weekdayMinutes } }),
      studySessionFixture({ goalId: goal.id, plannedMinutes: 0, userId: user.id }),
      Promise.all(
        ["Next lesson 1", "Next lesson 2"].map((title) =>
          playableLessonFixture({ lesson: { estimatedMinutes: 3, title }, steps: ["check"] }),
        ),
      ),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    // The plan's next lessons were saved first; settling the missed day then put the two lessons
    // an earlier day left ahead of them.
    await Promise.all(
      upcoming.map(({ lesson }, index) =>
        planItemFixture({
          kind: "lesson",
          lessonId: lesson.id,
          planId: plan.id,
          position: 3 + index,
          scheduledFor: new Date(today.getTime() + 2 * MS_PER_DAY),
          titleSnapshot: lesson.title,
        }),
      ),
    );

    const missed = await carryLessons({ count: 2, goalId: goal.id });

    const page = await openAs(browser, user);
    await page.goto("/today");

    // The lessons join the day in that order, and the first one opens: a lesson, not practice.
    const keepLearning = page
      .getByRole("region", { name: "Today's session" })
      .getByRole("button", { name: "Keep learning" });

    await expectHydrated(keepLearning);
    await keepLearning.click();
    await expect(page).toHaveURL(new RegExp(`/learn/${missed[0]?.id}\\?session=`, "u"));
    await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();

    await expect(
      prisma.studySessionBlock.findMany({
        orderBy: { position: "asc" },
        select: { kind: true, lessonId: true },
        where: { sessionId: session.id },
      }),
    ).resolves.toStrictEqual(
      [...missed, ...upcoming.map(({ lesson }) => lesson)].map((lesson) => ({
        kind: "learn",
        lessonId: lesson.id,
      })),
    );

    await page.context().close();
  });
});
