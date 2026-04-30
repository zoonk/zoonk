import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { expect, test } from "./fixtures";

async function createTestCourseWithLesson() {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-cal-course-${uniqueId}`,
    title: `E2E CAL Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-cal-ch-${uniqueId}`,
    title: `E2E CAL Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    organizationId: org.id,
    position: 0,
    slug: `e2e-cal-l-${uniqueId}`,
    title: `E2E CAL Lesson ${uniqueId}`,
  });

  return { chapter, course, lesson, org };
}

async function createTestCourseWithoutPlayableSteps() {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-cal-no-steps-${uniqueId}`,
    title: `E2E CAL No Steps ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-cal-no-steps-ch-${uniqueId}`,
    title: `E2E CAL No Steps Ch ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-cal-no-steps-l-${uniqueId}`,
    title: `E2E CAL No Steps Lesson ${uniqueId}`,
  });

  return { chapter, course, lesson };
}

async function createTestCourseWithPendingFirstLesson() {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-cal-pending-course-${uniqueId}`,
    title: `E2E CAL Pending Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-cal-pending-ch-${uniqueId}`,
    title: `E2E CAL Pending Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "pending",
    isPublished: true,
    kind: "explanation",
    organizationId: org.id,
    position: 0,
    slug: `e2e-cal-pending-l-${uniqueId}`,
    title: `E2E CAL Pending Lesson ${uniqueId}`,
  });

  return { chapter, course, lesson };
}

test.describe("Continue Lesson Link", () => {
  test("course page shows Start link for unauthenticated user", async ({ page }) => {
    const { course } = await createTestCourseWithLesson();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
  });

  test("course page Start link navigates to a lesson URL", async ({ page }) => {
    const { course, chapter, lesson } = await createTestCourseWithLesson();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
    await startLink.click();

    await expect(page).toHaveURL(
      new RegExp(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}$`),
    );
  });

  test("chapter page shows Start link for unauthenticated user", async ({ page }) => {
    const { chapter, course } = await createTestCourseWithLesson();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
  });

  test("pending AI lesson player links to lesson generation", async ({ page }) => {
    const { chapter, course, lesson } = await createTestCourseWithPendingFirstLesson();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByText(/lesson not available/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /create lesson/i })).toHaveAttribute(
      "href",
      `/generate/l/${lesson.id}`,
    );
  });

  test("course page falls back to first chapter when no playable step data", async ({ page }) => {
    const { chapter, course } = await createTestCourseWithoutPlayableSteps();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
    await expect(startLink).toHaveAttribute(
      "href",
      expect.stringContaining(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}`),
    );
  });

  test("chapter page falls back to first lesson when no playable step data", async ({ page }) => {
    const { chapter, course, lesson } = await createTestCourseWithoutPlayableSteps();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
    await expect(startLink).toHaveAttribute(
      "href",
      expect.stringContaining(`/ch/${chapter.slug}/l/${lesson.slug}`),
    );
  });

  test("shows Continue linking to the player when next lesson is ungenerated", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { lesson, chapter, course, org } = await createTestCourseWithLesson();

    const uniqueId = randomUUID().slice(0, 8);

    const pendingLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      organizationId: org.id,
      position: 1,
      slug: `e2e-cal-pending-l-${uniqueId}`,
      title: `E2E CAL Pending Lesson ${uniqueId}`,
    });

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson.id,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const continueLink = authenticatedPage.getByRole("link", { name: /^continue$/i });
    await expect(continueLink).toBeVisible();
    await expect(continueLink).toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${pendingLesson.slug}`,
    );
  });

  test("authenticated user with progress sees Continue on course page", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { lesson, course, org } = await createTestCourseWithLesson();

    await lessonFixture({
      chapterId: lesson.chapterId,
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      organizationId: org.id,
      position: 1,
      title: `E2E CAL Lesson 2 ${course.slug}`,
    });

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson.id,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const continueLink = authenticatedPage.getByRole("link", { name: /^continue$/i });
    await expect(continueLink).toBeVisible();
  });

  test("course page shows Continue linking to next lesson player when completed", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { lesson, chapter, course, org } = await createTestCourseWithLesson();

    const uniqueId = randomUUID().slice(0, 8);

    const nextLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
      position: 1,
      slug: `e2e-cal-next-l-${uniqueId}`,
      title: `E2E CAL Next Lesson ${uniqueId}`,
    });

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson.id,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const continueLink = authenticatedPage.getByRole("link", { name: /^continue$/i });
    await expect(continueLink).toBeVisible();
    await expect(continueLink).toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${nextLesson.slug}`,
    );
  });

  test("chapter page shows Continue linking to next chapter when completed", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, 8);

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-cal-chcomp-${uniqueId}`,
      title: `E2E CAL ChComp ${uniqueId}`,
    });

    const [chapter1, chapter2] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: org.id,
        position: 0,
        slug: `e2e-cal-chcomp-ch1-${uniqueId}`,
        title: `E2E CAL ChComp Ch1 ${uniqueId}`,
      }),
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: org.id,
        position: 1,
        slug: `e2e-cal-chcomp-ch2-${uniqueId}`,
        title: `E2E CAL ChComp Ch2 ${uniqueId}`,
      }),
    ]);

    const [lesson1] = await Promise.all([
      lessonFixture({
        chapterId: chapter1.id,
        isPublished: true,
        organizationId: org.id,
        position: 0,
        slug: `e2e-cal-chcomp-l1-${uniqueId}`,
        title: `E2E CAL ChComp L1 ${uniqueId}`,
      }),
      lessonFixture({
        chapterId: chapter2.id,
        isPublished: true,
        organizationId: org.id,
        position: 0,
        slug: `e2e-cal-chcomp-l2-${uniqueId}`,
        title: `E2E CAL ChComp L2 ${uniqueId}`,
      }),
    ]);

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson1.id,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter1.slug}`);

    const continueLink = authenticatedPage.getByRole("link", { name: /^continue$/i });
    await expect(continueLink).toBeVisible();
    await expect(continueLink).toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter2.slug}`,
    );
  });

  test("course page shows Review when all lessons completed", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { lesson, course } = await createTestCourseWithLesson();

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson.id,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const reviewLink = authenticatedPage.getByRole("link", { name: /^review$/i });
    await expect(reviewLink).toBeVisible();
  });
});
