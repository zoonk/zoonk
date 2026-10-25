import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { createLanguageChallenge } from "./language-challenge-fixtures";
import { asPersona, findPlanChapterId } from "./learn-personas";
import { openAs } from "./study-day";

/**
 * Pedro's plan (the stock market) gives "Where a share's price comes from", of its second phase,
 * today, while the first phase still has a topic being written and its challenge.
 */
const LESSON = "De onde vem o preço de uma ação";
const CHAPTER = "Como funcionam as negociações";

/** Written lessons of the current phase resume later, while another phase's chapter is next. */
async function createInterleavedPath() {
  const user = await createE2EUser(getBaseURL());
  const goal = await goalFixture({ timezone: "UTC", userId: user.id });
  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

  const plan = await planFixture({
    goalId: goal.id,
    phases: [
      { name: "Foundations", summary: "Understand the basics" },
      { name: "Putting it to use", summary: "Apply the basics" },
    ],
  });

  const titles = ["Putting it to use", "Ratios", "Fractions"];

  const chapters = await Promise.all(
    titles.map(async (title) => {
      const [chapter, lesson] = await Promise.all([
        libraryChapterFixture({ title }),
        libraryLessonFixture(),
      ]);

      return { chapter, lesson };
    }),
  );

  const today = new Date().toISOString().slice(0, 10);
  const resumes = `${new Date().getUTCFullYear() + 1}-01-02`;

  await Promise.all(
    chapters.map(({ chapter, lesson }, position) =>
      planItemFixture({
        chapterId: chapter.id,
        lessonId: lesson.id,
        phase: position === 0 ? 1 : 0,
        planId: plan.id,
        position,
        scheduledFor: new Date(position === 0 ? today : resumes),
      }),
    ),
  );

  return { resumes, user };
}

test.describe("Up next", () => {
  test("keeps a language unit current while its challenge waits and the next unit is ready", async ({
    browser,
  }) => {
    const { boss, course, nextLesson, plan, renting, user } = await createLanguageChallenge({
      final: false,
      nextLessonTodo: true,
      plus: true,
    });

    if (!nextLesson) {
      throw new Error("Expected the next unit's lesson");
    }

    const unit = await libraryChapterFixture({ title: "The next unit" });
    const tomorrow = toUTCMidnight(new Date(Date.now() + MS_PER_DAY));

    await Promise.all([
      courseChapterFixture({ chapterId: unit.id, courseId: course.id, position: 2 }),
      chapterLessonFixture({ chapterId: unit.id, lessonId: nextLesson.id }),
      prisma.planItem.update({ data: { scheduledFor: tomorrow }, where: { id: boss.id } }),
      prisma.planItem.updateMany({
        data: { chapterId: unit.id },
        where: { lessonId: nextLesson.id, planId: plan.id },
      }),
    ]);

    const page = await openAs(browser, user);

    try {
      await page.goto("/plan");
      const path = page.getByRole("list", { name: "Your path" });

      const current = path
        .getByRole("listitem")
        .filter({
          has: page.getByRole("link", { exact: true, name: `${renting.title}, you are here` }),
        });

      await expect(current).toHaveAttribute("aria-current", "step");
      await expect(current).toContainText("Lessons done · challenge");
      await expect(current.getByRole("img", { exact: true, name: "Up next" })).toHaveCount(0);
      const next = path.getByRole("link", { exact: true, name: "The next unit, up next" });
      await expect(next).toHaveAttribute("href", `/content/units/${unit.id}`);
      await expect(next.getByRole("img", { exact: true, name: "Up next" })).toBeVisible();
    } finally {
      await page.context().close();
    }
  });

  test("keeps the unfinished phase current while another phase's chapter is next", async ({
    browser,
  }) => {
    const { resumes, user } = await createInterleavedPath();
    const page = await openAs(browser, user);

    try {
      await page.goto("/plan");
      const path = page.getByRole("list", { name: "Your path" });
      const phaseName = "Foundations, you are here";

      const current = path
        .getByRole("listitem")
        .filter({ has: page.getByRole("button", { exact: true, name: phaseName }) });

      await expect(current).toHaveCount(1);
      await expect(current).toHaveAttribute("aria-current", "step");
      await expect(current).toContainText("Foundations");

      const date = new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(resumes));

      await expect(current).toContainText(`Continues ${date}`);

      const next = path.getByRole("link", { exact: true, name: "Putting it to use, up next" });
      await expect(next).toBeVisible();
      await expect(current.getByRole("img", { exact: true, name: "Up next" })).toHaveCount(0);
      await expect(path.getByRole("img", { exact: true, name: "Up next" })).toHaveCount(1);

      await expect(
        page
          .getByRole("region", { exact: true, name: "Phases" })
          .getByRole("button", { exact: true, name: phaseName }),
      ).toBeVisible();

      // Opening a phase by hand changes expansion, never the learner's current position.
      await current.getByRole("button", { exact: true, name: "Foundations, you are here" }).click();

      await expect(current.getByRole("link", { name: /Ratios/u })).toBeVisible();
      await expect(current).toHaveAttribute("aria-current", "step");
    } finally {
      await page.context().close();
    }
  });

  // Pedro's Today opened a lesson of his second phase while his Plan marked the first phase's
  // lessons still being written as up next.
  test("is the lesson Today opens, on the Plan and on its chapter's page, though its phase isn't the current one", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "stocks" }, async ({ page, user }) => {
      const chapterId = await findPlanChapterId(user.goalId, CHAPTER);

      await page.goto("/today");

      await expect(page.locator('[data-slot="today-next"]')).toContainText(LESSON);

      await page.goto("/plan");
      const path = page.getByRole("list", { name: "Your path" });

      // He's still in the first phase, which has a topic being written and its challenge left: it
      // stays closed and says so, so the path opens at his next chapter, in the second phase, and
      // highlights only that.
      const first = path
        .getByRole("listitem")
        .filter({
          has: page.getByRole("link", { exact: true, name: "O que é uma ação, you are here" }),
        });

      await expect(first).toContainText("O que é uma ação");
      await expect(first).toContainText("More lessons on the way");
      await expect(first).toHaveAttribute("aria-current", "step");

      const upNext = path.getByRole("link", { name: new RegExp(CHAPTER, "u") });
      await expect(upNext).toHaveAttribute("href", `/content/chapters/${chapterId}`);
      await expect(upNext.getByRole("img", { exact: true, name: "Up next" })).toBeVisible();

      expect(
        await path
          .getByRole("listitem")
          .evaluateAll(
            (items) => items.filter((item) => item.getAttribute("aria-current") === "step").length,
          ),
      ).toBe(1);

      await expect(path.getByRole("img", { exact: true, name: "Up next" })).toHaveCount(1);

      await upNext.click();
      await expect(page.getByRole("heading", { level: 1, name: CHAPTER })).toBeVisible();

      const lessons = page.getByRole("region", { name: "Lessons" });
      const next = lessons.getByRole("link", { name: /^Up next \d+\. /u });

      await expect(next).toHaveCount(1);
      await expect(next).toContainText(LESSON);

      await expect(page.getByRole("link", { name: /^(?:Continue|Start)/u })).toHaveAttribute(
        "href",
        (await next.getAttribute("href")) ?? "",
      );
    });
  });
});
