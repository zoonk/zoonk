import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { type Page, expect, test } from "./fixtures";

async function createCourseWithThreeLessons() {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-cl-reval-course-${uniqueId}`,
    title: `E2E CL Reval Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-cl-reval-chapter-${uniqueId}`,
    title: `E2E CL Reval Chapter ${uniqueId}`,
  });

  // Lesson 0: will be pre-completed by the user
  const lesson0 = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    organizationId: org.id,
    position: 0,
    slug: `e2e-cl-reval-completed-${uniqueId}`,
    title: `Completed Lesson ${uniqueId}`,
  });

  // Lesson 1: the current "next" lesson (static, user will complete it in the test)
  const lesson1 = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    organizationId: org.id,
    position: 1,
    slug: `e2e-cl-reval-current-${uniqueId}`,
    title: `Current Next ${uniqueId}`,
  });

  // Lesson 2: will become "next" after completing lesson 1
  const lesson2 = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    organizationId: org.id,
    position: 2,
    slug: `e2e-cl-reval-next-${uniqueId}`,
    title: `After Next ${uniqueId}`,
  });

  // Add static steps to the lessons completed through the player in these tests.
  await Promise.all([
    stepFixture({
      content: {
        text: `Review step body ${uniqueId}`,
        title: `Review Step Title ${uniqueId}`,
        variant: "text",
      },
      isPublished: true,
      lessonId: lesson0.id,
      position: 0,
    }),
    stepFixture({
      content: { text: `Step body ${uniqueId}`, title: `Step Title ${uniqueId}`, variant: "text" },
      isPublished: true,
      lessonId: lesson1.id,
      position: 0,
    }),
  ]);

  return { chapter, course, lesson0, lesson1, lesson2, uniqueId };
}

/**
 * The completion action persists progress in `after()`, so tests that need
 * the following navigation to read fresh progress must wait for the database
 * row rather than only the server action response.
 */
async function expectLessonCompleted({ lessonId, userId }: { lessonId: string; userId: string }) {
  await expect(async () => {
    const progress = await prisma.lessonProgress.findUnique({
      where: { userLesson: { lessonId, userId } },
    });

    expect(progress?.completedAt).not.toBeNull();
  }).toPass({ timeout: 10_000 });
}

/**
 * Static text lessons complete after one keyboard continue action. Waiting on
 * the server action response plus the DB row keeps the next navigation from
 * racing the background persistence work.
 */
async function completeStaticLesson({
  lessonId,
  page,
  userId,
}: {
  lessonId: string;
  page: Page;
  userId: string;
}) {
  const serverActionResponse = page.waitForResponse(
    (resp) => resp.request().method() === "POST" && resp.ok(),
  );

  await expect(async () => {
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("status")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });

  await expect(page.getByRole("status").getByText("Completed", { exact: true })).toBeVisible();
  await serverActionResponse;
  await expectLessonCompleted({ lessonId, userId });
}

test.describe("Continue Learning Revalidation", () => {
  test("home page updates continue learning after completing a lesson", async ({
    baseURL,
    browser,
  }) => {
    const user = await createE2EUser(baseURL!);
    const browserContext = await browser.newContext({ storageState: user.storageState });
    const page = await browserContext.newPage();
    const { lesson0, lesson1, course, uniqueId } = await createCourseWithThreeLessons();

    // Pre-complete lesson 0 so getContinueLearning returns this course with lesson 1 as "next"
    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: lesson0.id,
        userId: user.id,
      }),
      userProgressFixture({ totalBrainPower: 100n, userId: user.id }),
      prisma.courseUser.create({ data: { courseId: course.id, userId: user.id } }),
      prisma.course.update({ data: { userCount: { increment: 1 } }, where: { id: course.id } }),
    ]);

    // 1. Navigate to home page (full load)
    await page.goto("/");

    const nextLink = page.getByRole("link", {
      name: new RegExp(`Next:.*Current Next ${uniqueId}`, "u"),
    });

    await expect(nextLink.first()).toBeVisible();

    // 2. Click the continue learning card link (client-side navigation)
    await nextLink.first().click();
    await page.waitForURL(new RegExp(`/l/e2e-cl-reval-current-${uniqueId}$`, "u"));
    await page.waitForLoadState("networkidle");

    // 3. Complete the static lesson and wait for durable progress before navigating again.
    await completeStaticLesson({ lessonId: lesson1.id, page, userId: user.id });

    // 4. Click "All Lessons" (client-side navigation)
    await page.getByRole("link", { name: /all lessons/iu }).click();
    await page.waitForURL(new RegExp(`e2e-cl-reval-chapter-${uniqueId}$`, "u"));

    // 5. Click the Home link in the navbar (client-side navigation — Router Cache)
    await page.getByRole("link", { name: /home page/iu }).click();
    await page.waitForURL(/\/$/u);
    await page.waitForLoadState("networkidle");

    // 6. Continue learning should show the NEW next lesson, not the old one
    await expect(
      page.getByText(new RegExp(`Next:.*After Next ${uniqueId}`, "u")).first(),
    ).toBeVisible();

    await browserContext.close();
  });

  test("chapter continue link stays on the furthest incomplete lesson after review", async ({
    baseURL,
    browser,
  }) => {
    const user = await createE2EUser(baseURL!);
    const browserContext = await browser.newContext({ storageState: user.storageState });
    const page = await browserContext.newPage();

    const { chapter, course, lesson0, lesson1, lesson2, uniqueId } =
      await createCourseWithThreeLessons();

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: lesson0.id,
        userId: user.id,
      }),
      userProgressFixture({ totalBrainPower: 100n, userId: user.id }),
      prisma.courseUser.create({ data: { courseId: course.id, userId: user.id } }),
      prisma.course.update({ data: { userCount: { increment: 1 } }, where: { id: course.id } }),
    ]);

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}`);

    const staleContinueLink = page.getByRole("link", { name: "Continue 33% complete" });

    await expect(staleContinueLink).toHaveAttribute(
      "href",
      `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson1.slug}`,
    );

    await staleContinueLink.click();
    await page.waitForURL(new RegExp(`/l/e2e-cl-reval-current-${uniqueId}$`, "u"));
    await completeStaticLesson({ lessonId: lesson1.id, page, userId: user.id });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson0.slug}`);
    await completeStaticLesson({ lessonId: lesson0.id, page, userId: user.id });

    await page.getByRole("link", { name: /all lessons/iu }).click();
    await page.waitForURL(new RegExp(`e2e-cl-reval-chapter-${uniqueId}$`, "u"));

    const currentContinueLink = page.getByRole("link", { name: "Continue 67% complete" });

    await expect(currentContinueLink).toHaveAttribute(
      "href",
      `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson2.slug}`,
    );

    await expect(currentContinueLink).not.toHaveAttribute(
      "href",
      `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson1.slug}`,
    );

    await browserContext.close();
  });
});
