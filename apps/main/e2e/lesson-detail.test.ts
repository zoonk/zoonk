import { randomUUID } from "node:crypto";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createTestLesson(options?: {
  generationStatus?: "pending" | "completed";
  stepCount?: number;
}) {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-lesson-course-${uniqueId}`,
    title: `E2E Lesson Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-lesson-chapter-${uniqueId}`,
    title: `E2E Lesson Chapter ${uniqueId}`,
  });

  const lessonTitle = `E2E Lesson Lesson ${uniqueId}`;

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E lesson description ${uniqueId}`,
    generationStatus: options?.generationStatus ?? "completed",
    isPublished: true,
    kind: "explanation",
    organizationId: org.id,
    slug: `e2e-lesson-lesson-${uniqueId}`,
    title: lessonTitle,
  });

  if (options?.generationStatus !== "pending") {
    const count = options?.stepCount ?? 1;

    await Promise.all(
      Array.from({ length: count }, (_, idx) =>
        stepFixture({
          content: {
            text: `Test step content ${uniqueId} #${idx}`,
            title: `Step ${uniqueId} #${idx}`,
            variant: "text",
          },
          isPublished: true,
          lessonId: lesson.id,
          position: idx,
        }),
      ),
    );
  }

  return { chapter, course, lesson, lessonTitle, uniqueId };
}

/**
 * A practice lesson depends on the explanation lessons before it. This creates
 * the smallest published AI chapter where the practice player page should send
 * the learner to the missing explanation's generation page instead of starting
 * practice generation.
 */
async function createBlockedPracticeLesson() {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-blocked-player-course-${uniqueId}`,
    title: `E2E Blocked Player Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-blocked-player-chapter-${uniqueId}`,
    title: `E2E Blocked Player Chapter ${uniqueId}`,
  });

  const [explanation, practice] = await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "explanation",
      organizationId: org.id,
      position: 0,
      slug: `e2e-blocked-player-explanation-${uniqueId}`,
      title: `E2E Blocked Player Explanation ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "practice",
      organizationId: org.id,
      position: 1,
      slug: `e2e-blocked-player-practice-${uniqueId}`,
      title: `E2E Blocked Player Practice ${uniqueId}`,
    }),
  ]);

  return { chapter, course, explanation, practice };
}

/**
 * Review lessons are completed structural rows, but they only have playable
 * content after earlier generated lessons have saved reviewable steps.
 */
async function createEmptyReviewLesson() {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-review-empty-course-${uniqueId}`,
    title: `E2E Review Empty Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-review-empty-chapter-${uniqueId}`,
    title: `E2E Review Empty Chapter ${uniqueId}`,
  });

  const [requiredLesson, review] = await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "explanation",
      organizationId: org.id,
      position: 0,
      slug: `e2e-review-empty-explanation-${uniqueId}`,
      title: `E2E Review Empty Explanation ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "review",
      organizationId: org.id,
      position: 1,
      slug: `e2e-review-empty-review-${uniqueId}`,
      title: `E2E Review Empty Review ${uniqueId}`,
    }),
  ]);

  return { chapter, course, requiredLesson, review };
}

test.describe("Lesson Player Page", () => {
  test("generated lesson player renders the seeded step content", async ({ page }) => {
    const { chapter, course, lesson, uniqueId } = await createTestLesson({
      generationStatus: "completed",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByRole("heading", { name: `Step ${uniqueId} #0` })).toBeVisible();
    await expect(page.getByText(`Test step content ${uniqueId} #0`)).toBeVisible();
  });

  test("close link has correct href", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLesson({ generationStatus: "completed" });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    const closeLink = page.getByRole("link", { name: /close/i });

    await expect(closeLink).toHaveAttribute(
      "href",
      new RegExp(`/b/ai/c/${course.slug}/ch/${chapter.slug}$`),
    );
  });

  test("pending lessons show the create state and link details", async ({ page }) => {
    const { lesson, chapter, course } = await createTestLesson({ generationStatus: "pending" });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByText(/lesson not available/i)).toBeVisible();
    await expect(page.getByText(/hasn't been created yet/i)).toBeVisible();
    const generateLink = page.getByRole("link", { name: /create lesson/i });

    await expect(generateLink).toBeVisible();
    await expect(generateLink).toHaveAttribute("href", new RegExp(`/generate/l/${lesson.id}`));
    await expect(generateLink).toHaveAttribute("rel", "nofollow");
  });

  test("blocked practice lessons link to the required explanation generation page", async ({
    page,
  }) => {
    const { chapter, course, explanation, practice } = await createBlockedPracticeLesson();

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${practice.slug}`);

    await expect(page.getByText("Lesson locked")).toBeVisible();
    await expect(page.getByText("Create the required lesson first.")).toBeVisible();

    const requiredLessonLink = page.getByRole("link", { name: "Open required lesson" });
    await expect(requiredLessonLink).toBeVisible();
    await expect(requiredLessonLink).toHaveAttribute("href", `/generate/l/${explanation.id}`);
    await expect(requiredLessonLink).toHaveAttribute("rel", "nofollow");
  });

  test("empty review lessons link to the first earlier lesson that needs generation", async ({
    page,
  }) => {
    const { chapter, course, requiredLesson, review } = await createEmptyReviewLesson();

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${review.slug}`);

    await expect(page.getByText("Review locked")).toBeVisible();

    await expect(
      page.getByText("Create earlier lessons first, then come back to review."),
    ).toBeVisible();

    const requiredLessonLink = page.getByRole("link", { name: "Open required lesson" });
    await expect(requiredLessonLink).toBeVisible();
    await expect(requiredLessonLink).toHaveAttribute("href", `/generate/l/${requiredLesson.id}`);
    await expect(requiredLessonLink).toHaveAttribute("rel", "nofollow");
  });

  test("pending non-AI lessons do not show a generate link", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const org = await createOrganization();

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-lesson-course-${uniqueId}`,
      title: `Non AI Lesson Course ${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-lesson-chapter-${uniqueId}`,
      title: `Non AI Lesson Chapter ${uniqueId}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-lesson-lesson-${uniqueId}`,
      title: `Non AI Lesson Lesson ${uniqueId}`,
    });

    await page.goto(`/b/${org.slug}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByText(/lesson not available/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /create lesson/i })).not.toBeVisible();
  });

  test("pressing escape navigates to the chapter page", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLesson({ generationStatus: "completed" });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByRole("link", { name: /close/i })).toBeVisible();

    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(new RegExp(`/b/ai/c/${course.slug}/ch/${chapter.slug}$`));
  });

  test("non-existent lesson shows 404 page", async ({ page }) => {
    const { chapter, course, uniqueId } = await createTestLesson();

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/missing-${uniqueId}`);

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("page title contains lesson title", async ({ page }) => {
    const { chapter, course, lesson, lessonTitle } = await createTestLesson({
      generationStatus: "completed",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page).toHaveTitle(new RegExp(lessonTitle));
  });

  test("unpublished lesson shows 404 page", async ({ page }) => {
    const org = await getAiOrganization();

    const uniqueId = randomUUID().slice(0, 8);

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-unpub-lesson-course-${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-unpub-lesson-chapter-${uniqueId}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: false,
      organizationId: org.id,
      slug: `e2e-unpub-lesson-lesson-${uniqueId}`,
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });
});
