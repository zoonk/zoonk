import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseBandsFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { startCourseWithLevel } from "./course-start";
import { expect, test } from "./fixtures";

/**
 * A visitor from a search result: the answer on the public page opens the lesson as a guest, and
 * the lesson ends with "Build my plan" (the lesson's course as their goal). The API's and auth's
 * own tests cover moving a guest's work to the account they sign up with.
 */

/** A published course whose first lesson a visitor opens from its public page. */
async function createPublicLesson() {
  const id = randomUUID().slice(0, 8);
  const org = await getAiOrganization();

  const course = await courseFixture({
    isPublished: true,
    language: "en",
    organizationId: org.id,
    slug: `e2e-guest-quantum-${id}`,
    title: `Quantum physics ${id}`,
  });

  const [chapter, skill] = await Promise.all([
    libraryChapterFixture({
      homeCourseId: course.id,
      slug: `atom-${id}`,
      title: `Inside the atom ${id}`,
    }),
    skillFixture({ name: `Explain why atoms are stable ${id}` }),
  ]);

  const lesson = await libraryLessonFixture({
    contentStatus: "completed",
    estimatedMinutes: 5,
    homeChapterId: chapter.id,
    slug: `electron-${id}`,
    title: `Why doesn't the electron fall in ${id}`,
  });

  await Promise.all([
    // The course's later bands are written too, so the guest's start plans from this outline.
    courseBandsFixture({ courseId: course.id, levels: ["intermediate", "advanced"] }),
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    libraryStepFixture({
      content: {
        options: [
          { id: "planet", isCorrect: false, text: "Yes, like a tiny planet" },
          { id: "cloud", isCorrect: true, text: "No, it's more like a cloud" },
        ],
        question: "Does the electron circle the nucleus like Earth circles the Sun?",
        reveal: "It spreads out into a cloud of places where it could be.",
        variant: "guess",
      },
      kind: "hook",
      lessonId: lesson.id,
      position: 0,
    }),
    libraryStepFixture({
      content: {
        basis: null,
        options: [
          { id: "a", isCorrect: true, reason: "Right.", text: "A cloud" },
          { id: "b", isCorrect: false, reason: "A planet would spiral in.", text: "A planet" },
        ],
        question: "Which picture fits?",
      },
      kind: "check",
      lessonId: lesson.id,
      position: 1,
    }),
  ]);

  return {
    course,
    lessonPath: `/b/${org.slug}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`,
  };
}

test.describe("A visitor from a public lesson page", () => {
  test("finishes the lesson as a guest and plans its course", async ({ page }) => {
    const { course, lessonPath } = await createPublicLesson();

    await page.goto(lessonPath);
    await page.getByRole("button", { name: "No, it's more like a cloud" }).click();

    await expect(page).toHaveURL(/\/learn\/[0-9a-f-]{36}/u);

    await expect(
      page.getByText("It spreads out into a cloud of places where it could be."),
    ).toBeVisible();

    await page.getByRole("button", { name: /^Continue/u }).click();

    await page.getByRole("radio", { name: "A cloud" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    // Brain Power shows once the server saved the lesson and its answers.
    await expect(page.getByText("Brain Power")).toBeVisible();

    const guest = await prisma.attempt.findFirstOrThrow({
      select: { user: { select: { id: true, isAnonymous: true } } },
      where: { step: { lesson: { homeChapter: { homeCourseId: course.id } } } },
    });

    expect(guest.user.isAnonymous).toBe(true);

    // "Build my plan" starts the lesson's course without typing it again. The lesson was in the
    // course's first chapter, so the plan starts at the course's beginning, after their level.
    await page.getByRole("button", { name: "Build my plan" }).click();
    await expect(page).toHaveURL(new RegExp(`/start/course/${course.id}$`, "u"));
    await startCourseWithLevel(page);
    await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

    const goalId = new URL(page.url()).pathname.split("/").at(-1) ?? "";

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goalId } })).resolves.toMatchObject({
      details: { courseStart: { chapterId: null }, level: "basic" },
      primaryCourseId: course.id,
      userId: guest.user.id,
    });
  });
});
