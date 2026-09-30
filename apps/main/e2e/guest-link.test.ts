import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
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
import { type Page, expect, test } from "./fixtures";
import { setDeviceMode } from "./learn-personas";

/**
 * A visitor from a search result: the answer on the public page opens the lesson as a guest, the
 * lesson ends with where it fits, "Build my plan" (the lesson's course as their goal) and "Create
 * an account to save", and signing up keeps what they did.
 */

/**
 * A published course whose lesson a visitor opens from its public page. With `laterChapter`, the
 * lesson's chapter comes after another one, so a plan from it starts there.
 */
async function createPublicLesson({ laterChapter = false } = {}) {
  const id = randomUUID().slice(0, 8);
  const org = await getAiOrganization();

  const course = await courseFixture({
    isPublished: true,
    language: "en",
    organizationId: org.id,
    slug: `e2e-guest-quantum-${id}`,
    title: `Quantum physics ${id}`,
  });

  const [chapter, earlier, skill] = await Promise.all([
    libraryChapterFixture({
      homeCourseId: course.id,
      slug: `atom-${id}`,
      title: `Inside the atom ${id}`,
    }),
    laterChapter
      ? libraryChapterFixture({
          homeCourseId: course.id,
          slug: `waves-${id}`,
          title: `Waves ${id}`,
        })
      : null,
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
    earlier && courseChapterFixture({ chapterId: earlier.id, courseId: course.id, position: 0 }),
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: earlier ? 1 : 0 }),
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
  test("finishes the lesson as a guest, sees where it fits and keeps it by signing up", async ({
    page,
  }) => {
    const { course, lessonPath } = await createPublicLesson();
    await setDeviceMode(page.context(), "fun");

    await finishLessonFromPublicPage(page, lessonPath);

    await expect(page.getByText("This is part of")).toBeVisible();
    await expect(page.getByText(course.title)).toBeVisible();

    await expect(
      page.getByText("Save your progress and a quick review comes back to help it stick."),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "Build my plan" })).toBeVisible();

    await expect(page.getByRole("link", { name: "Create an account to save" })).toHaveAttribute(
      "href",
      "/login",
    );

    const guest = await prisma.attempt.findFirstOrThrow({
      select: { userId: true },
      where: { step: { lesson: { homeChapter: { homeCourseId: course.id } } } },
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
  });
});

test("the lesson's screens load only with a session, so they aren't in a visitor's HTML", async ({
  page,
}) => {
  const { lessonId } = await createPublicLesson();

  const response = await page.request.get(`/learn/${lessonId}`);
  const html = await response.text();

  expect(response.ok()).toBe(true);
  expect(html).toContain("the electron fall in");
  expect(html).not.toContain("Which picture fits?");
  expect(html).not.toContain("It spreads out into a cloud of places where it could be.");

  // In the browser the visitor becomes a guest and the lesson opens.
  await page.goto(`/learn/${lessonId}`);
  await expect(page.getByRole("radio", { name: "No, it's more like a cloud" })).toBeVisible();
});

test("'Build my plan' starts the lesson's course without typing it again", async ({ page }) => {
  const { course, lessonPath } = await createPublicLesson();

  await finishLessonFromPublicPage(page, lessonPath);
  await page.getByRole("button", { name: "Build my plan" }).click();

  await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

  // The lesson was in the course's first chapter: the plan starts at the course's beginning.
  await expect(page.getByRole("heading", { name: "How much do you already know?" })).toBeVisible();

  const goalId = new URL(page.url()).pathname.split("/").at(-1) ?? "";

  await expect(prisma.goal.findUniqueOrThrow({ where: { id: goalId } })).resolves.toMatchObject({
    details: { courseStart: { chapterId: null } },
    primaryCourseId: course.id,
  });
});

test("'Build my plan' after a later chapter's lesson starts the plan at that chapter", async ({
  page,
}) => {
  const { chapter, course, lessonPath } = await createPublicLesson({ laterChapter: true });

  await finishLessonFromPublicPage(page, lessonPath);
  await page.getByRole("button", { name: "Build my plan" }).click();

  await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

  await expect(
    page.getByRole("heading", { name: "How much time can you study each day?" }),
  ).toBeVisible();

  const goalId = new URL(page.url()).pathname.split("/").at(-1) ?? "";

  await expect(prisma.goal.findUniqueOrThrow({ where: { id: goalId } })).resolves.toMatchObject({
    details: { courseStart: { chapterId: chapter.id } },
    primaryCourseId: course.id,
  });
});
