import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { chapterLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { pressUntil } from "./study-day";

/** A plan whose final challenge is won and one lesson is left: finishing it finishes the course. */
async function createLastLessonGoal(userId: string) {
  const goal = await goalFixture({ timezone: "UTC", title: "Understand atoms", userId });

  const [chapter, skill, { lesson }] = await Promise.all([
    libraryChapterFixture({ title: "Inside the atom" }),
    skillFixture({ name: "Atoms" }),
    playableLessonFixture({ lesson: { title: "An almost empty atom" }, steps: ["explanation"] }),
  ]);

  const [plan] = await Promise.all([
    planFixture({
      goalId: goal.id,
      items: [
        {
          chapterId: chapter.id,
          lessonId: lesson.id,
          scheduledFor: new Date(Date.now() + MS_PER_DAY),
          skillId: skill.id,
        },
      ],
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
  ]);

  await prisma.planItem.updateMany({
    data: { status: "done" },
    where: { kind: "boss", planId: plan.id },
  });

  return { goal, lesson };
}

test.describe("Course certificates", () => {
  test("finishing a course's last lesson shows its certificate, whose link opens for anyone", async ({
    browser,
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { goal, lesson } = await createLastLessonGoal(noProgressUser.id);

    const name = await prisma.user.findUniqueOrThrow({
      select: { name: true },
      where: { id: noProgressUser.id },
    });

    await page.goto(`/learn/${lesson.id}`);
    await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
    await page.getByRole("button", { name: /^Continue/u }).click();

    const moment = page.getByRole("dialog", { name: "Course complete!" });
    await expect(moment).toBeVisible();
    await expect(moment.getByText(`On your certificate: ${name.name}`)).toBeVisible();

    const certificate = await prisma.certificate.findFirstOrThrow({
      select: { code: true },
      where: { goalId: goal.id, kind: "course" },
    });

    // The moment ignores a tap in its first half second, meant for the screen before it.
    await pressUntil(() => moment.getByRole("button", { name: /^Continue/u }).click(), moment, {
      visible: false,
    });

    await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    await expect
      .poll(async () => {
        const row = await prisma.certificate.findUniqueOrThrow({
          select: { shownAt: true },
          where: { code: certificate.code },
        });

        return row.shownAt !== null;
      })
      .toBe(true);

    const visitor = await browser.newContext();
    const visitorPage = await visitor.newPage();

    try {
      await visitorPage.goto(`/c/${certificate.code}`);

      await expect(
        visitorPage.getByRole("heading", {
          level: 1,
          name: `${name.name} completed Understand atoms`,
        }),
      ).toBeVisible();

      await expect(visitorPage.getByRole("button", { name: "Share" })).toBeHidden();
    } finally {
      await visitor.close();
    }
  });
});
