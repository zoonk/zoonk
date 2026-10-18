import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
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
import { type Page, expect, test } from "./fixtures";

/**
 * A visitor from a search result: the answer on the public page opens the lesson as a guest, the
 * lesson ends with where it fits, "Build my plan" (the lesson's course as their goal) and "Create
 * an account to save", and signing up keeps what they did.
 */

/** A published course whose first lesson a visitor opens from its public page; another follows it. */
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

  const [lesson, nextLesson, nextSkill] = await Promise.all([
    libraryLessonFixture({
      contentStatus: "completed",
      estimatedMinutes: 5,
      homeChapterId: chapter.id,
      slug: `electron-${id}`,
      title: `Why doesn't the electron fall in ${id}`,
    }),
    libraryLessonFixture({
      contentStatus: "completed",
      estimatedMinutes: 5,
      homeChapterId: chapter.id,
      slug: `orbitals-${id}`,
      title: `Where the electron can be ${id}`,
    }),
    skillFixture({ name: `Read an orbital diagram ${id}` }),
  ]);

  await Promise.all([
    // The course's later bands are written too, so the guest's start plans from this outline.
    courseBandsFixture({ courseId: course.id, levels: ["intermediate", "advanced"] }),
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: nextLesson.id, position: 1 }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    lessonSkillFixture({ lessonId: nextLesson.id, skillId: nextSkill.id }),
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
    chapter,
    course,
    lessonId: lesson.id,
    lessonPath: `/b/${org.slug}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`,
    nextLesson,
  };
}

async function finishLessonFromPublicPage(page: Page, lessonPath: string) {
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
}

test.describe("A visitor from a public lesson page", () => {
  test("finishes the lesson as a guest, sees where it fits, plans its course and keeps it by signing up", async ({
    page,
  }) => {
    const { course, lessonId, lessonPath } = await createPublicLesson();

    // The lesson's screens load only with a session, so they aren't in a visitor's HTML.
    const response = await page.request.get(`/learn/${lessonId}`);
    const html = await response.text();

    expect(response.ok()).toBe(true);
    expect(html).toContain("the electron fall in");
    expect(html).not.toContain("Which picture fits?");
    expect(html).not.toContain("It spreads out into a cloud of places where it could be.");

    await finishLessonFromPublicPage(page, lessonPath);

    await expect(page.getByText("This is part of")).toBeVisible();
    await expect(page.getByText(course.title)).toBeVisible();

    await expect(
      page.getByText("Save your progress and a quick review comes back to help it stick."),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Create an account to save" })).toHaveAttribute(
      "href",
      "/login",
    );

    const guest = await prisma.attempt.findFirstOrThrow({
      select: { userId: true },
      where: { step: { lesson: { homeChapter: { homeCourseId: course.id } } } },
    });

    // "Build my plan" starts the lesson's course without typing it again. The lesson was in the
    // course's first chapter, so the plan starts at the course's beginning, after their level.
    await page.getByRole("button", { name: "Build my plan" }).click();
    await expect(page).toHaveURL(new RegExp(`/start/course/${course.id}$`, "u"));

    const level = "How much do you already know?";
    await expect(page.getByRole("heading", { name: level })).toBeVisible();
    await startCourseWithLevel(page);
    await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

    const goalId = new URL(page.url()).pathname.split("/").at(-1) ?? "";

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goalId } })).resolves.toMatchObject({
      details: { courseStart: { chapterId: null }, level: "basic" },
      primaryCourseId: course.id,
    });

    // Creating the account moves the guest's lesson to it (the sign-up screen lives on central auth).
    const email = `e2e-guest-save-${randomUUID().slice(0, 8)}@zoonk.test`;

    const signUp = await page.request.post("/api/auth/sign-up/email", {
      data: { email, name: "Saved Guest", password: "password123" },
      headers: { Origin: getBaseURL() },
    });

    expect(signUp.ok()).toBe(true);

    const account = await prisma.user.findUniqueOrThrow({ where: { email } });

    await expect
      .poll(() => prisma.attempt.count({ where: { userId: account.id } }))
      .toBeGreaterThan(0);

    await expect.poll(() => prisma.user.findUnique({ where: { id: guest.userId } })).toBeNull();

    // The account picks up the questions the guest left, instead of a plan on defaults they never
    // chose (10 minutes a day, every day).
    await page.goto("/today");
    await expect(page.getByText("Setting up", { exact: true })).toBeVisible();

    await expect(page.getByRole("link", { name: "Continue setting up" })).toHaveAttribute(
      "href",
      `/start/${goalId}`,
    );

    await expect(prisma.studySession.count({ where: { goalId } })).resolves.toBe(0);
  });

  test("counts the lesson finished as a guest in the plan built from it: Today goes on to the next one", async ({
    page,
  }) => {
    const { lessonPath, nextLesson } = await createPublicLesson();

    await finishLessonFromPublicPage(page, lessonPath);
    await page.getByRole("button", { name: "Build my plan" }).click();
    await startCourseWithLevel(page);
    await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

    // The rest of onboarding is behind them, as the guest would leave it: only the plan is left.
    const goalId = new URL(page.url()).pathname.split("/").at(-1) ?? "";

    await prisma.goal.update({
      data: {
        details: {
          answered: ["targetDate", "level", "schedule", "age", "memory", "buddy", "placement"],
          courseStart: { chapterId: null },
        },
      },
      where: { id: goalId },
    });

    await page.goto(`/start/${goalId}`);
    await expect(page.getByText("Plan created", { exact: true })).toBeVisible();

    // The plan holds the whole course: its beginner chapter's phase first, then its later bands.
    await expect(page.getByRole("region", { name: "Phases" })).toBeVisible();

    await page.getByRole("link", { name: "Start" }).click();
    await expect(page).toHaveURL(/\/today$/u);

    // The lesson they just finished isn't asked again: the day starts with the one after it.
    const next = page.locator('[data-slot="today-next"]');
    await expect(next).toContainText(nextLesson.title);
  });
});
