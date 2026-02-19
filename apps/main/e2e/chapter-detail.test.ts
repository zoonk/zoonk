import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { normalizeString } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";

const uniqueId = randomUUID().slice(0, 8);

let chapterUrl: string;
let courseSlug: string;
let courseTitle: string;
let chapterTitle: string;
let unpublishedChapterSlug: string;
let noLessonsChapterId: number;
let noLessonsChapterUrl: string;
let lessonNames: { first: string; second: string };
let lessonSlugs: { first: string; second: string };
let ptChapterUrl: string;
let ptLessonNames: { first: string; second: string };

test.beforeAll(async () => {
  const org = await getAiOrganization();

  courseTitle = `E2E ChDetail Course ${uniqueId}`;
  courseSlug = `e2e-chdetail-course-${uniqueId}`;

  const course = await courseFixture({
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString(courseTitle),
    organizationId: org.id,
    slug: courseSlug,
    title: courseTitle,
  });

  chapterTitle = `E2E ChDetail Chapter ${uniqueId}`;
  const chapterSlug = `e2e-chdetail-ch-${uniqueId}`;

  const chapter = await chapterFixture({
    courseId: course.id,
    description: `Different types of learning ${uniqueId}`,
    isPublished: true,
    normalizedTitle: normalizeString(chapterTitle),
    organizationId: org.id,
    position: 0,
    slug: chapterSlug,
    title: chapterTitle,
  });

  chapterUrl = `/b/${AI_ORG_SLUG}/c/${courseSlug}/ch/${chapterSlug}`;

  lessonNames = {
    first: `What is E2E Testing ${uniqueId}`,
    second: `History of E2E Testing ${uniqueId}`,
  };

  lessonSlugs = {
    first: `e2e-what-is-${uniqueId}`,
    second: `e2e-history-of-${uniqueId}`,
  };

  const unpublishedLessonTitle = `Unpublished Lesson ${uniqueId}`;

  await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      normalizedTitle: normalizeString(lessonNames.first),
      organizationId: org.id,
      position: 0,
      slug: lessonSlugs.first,
      title: lessonNames.first,
    }),
    lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      normalizedTitle: normalizeString(lessonNames.second),
      organizationId: org.id,
      position: 1,
      slug: lessonSlugs.second,
      title: lessonNames.second,
    }),
    lessonFixture({
      chapterId: chapter.id,
      isPublished: false,
      normalizedTitle: normalizeString(unpublishedLessonTitle),
      organizationId: org.id,
      position: 2,
      slug: `e2e-unpub-lesson-${uniqueId}`,
      title: unpublishedLessonTitle,
    }),
  ]);

  // Unpublished chapter for 404 test
  unpublishedChapterSlug = `e2e-unpub-ch-${uniqueId}`;

  await chapterFixture({
    courseId: course.id,
    isPublished: false,
    normalizedTitle: normalizeString(`Unpublished Chapter ${uniqueId}`),
    organizationId: org.id,
    position: 1,
    slug: unpublishedChapterSlug,
    title: `Unpublished Chapter ${uniqueId}`,
  });

  // Chapter with no lessons (for redirect test)
  const noLessonsChapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    normalizedTitle: normalizeString(`No Lessons Chapter ${uniqueId}`),
    organizationId: org.id,
    position: 2,
    slug: `e2e-no-lessons-ch-${uniqueId}`,
    title: `No Lessons Chapter ${uniqueId}`,
  });

  noLessonsChapterId = noLessonsChapter.id;
  noLessonsChapterUrl = `/b/${AI_ORG_SLUG}/c/${courseSlug}/ch/${noLessonsChapter.slug}`;

  // Portuguese course + chapter + lessons
  const ptCourse = await courseFixture({
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString(`E2E ChDetail Curso ${uniqueId}`),
    organizationId: org.id,
    slug: `e2e-chdetail-curso-${uniqueId}`,
    title: `E2E ChDetail Curso ${uniqueId}`,
  });

  const ptChapter = await chapterFixture({
    courseId: ptCourse.id,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString(`Introdução ao E2E ${uniqueId}`),
    organizationId: org.id,
    position: 0,
    slug: `e2e-intro-pt-ch-${uniqueId}`,
    title: `Introdução ao E2E ${uniqueId}`,
  });

  ptChapterUrl = `/pt/b/${AI_ORG_SLUG}/c/${ptCourse.slug}/ch/${ptChapter.slug}`;

  ptLessonNames = {
    first: `O que é E2E Testing ${uniqueId}`,
    second: `História do E2E Testing ${uniqueId}`,
  };

  await Promise.all([
    lessonFixture({
      chapterId: ptChapter.id,
      isPublished: true,
      language: "pt",
      normalizedTitle: normalizeString(ptLessonNames.first),
      organizationId: org.id,
      position: 0,
      slug: `e2e-oque-pt-${uniqueId}`,
      title: ptLessonNames.first,
    }),
    lessonFixture({
      chapterId: ptChapter.id,
      isPublished: true,
      language: "pt",
      normalizedTitle: normalizeString(ptLessonNames.second),
      organizationId: org.id,
      position: 1,
      slug: `e2e-historia-pt-${uniqueId}`,
      title: ptLessonNames.second,
    }),
  ]);
});

test.describe("Chapter Detail Page", () => {
  test("shows chapter content with title, description, and position", async ({ page }) => {
    await page.goto(chapterUrl);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: chapterTitle,
      }),
    ).toBeVisible();

    await expect(page.getByText(`Different types of learning ${uniqueId}`)).toBeVisible();

    const positionIcon = page.getByRole("img", { name: /chapter 01/i }).first();
    await expect(positionIcon).toBeVisible();
  });

  test("displays lessons list with position numbers", async ({ page }) => {
    await page.goto(chapterUrl);

    await expect(page.getByRole("link", { name: lessonNames.first })).toBeVisible();
    await expect(page.getByRole("link", { name: lessonNames.second })).toBeVisible();

    await expect(
      page.getByRole("link", { name: `Unpublished Lesson ${uniqueId}` }),
    ).not.toBeVisible();
  });

  test("lesson link navigates to the correct URL", async ({ page }) => {
    await page.goto(chapterUrl);

    const lessonLink = page.getByRole("link", { name: lessonNames.first });
    await expect(lessonLink).toBeVisible();

    await lessonLink.click();

    await expect(page).toHaveURL(new RegExp(`${chapterUrl}/l/${lessonSlugs.first}`));
  });

  test("non-existent chapter shows 404 page", async ({ page }) => {
    await page.goto(`/b/${AI_ORG_SLUG}/c/${courseSlug}/ch/nonexistent-chapter-${uniqueId}`);

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("unpublished chapter shows 404 page", async ({ page }) => {
    await page.goto(`/b/${AI_ORG_SLUG}/c/${courseSlug}/ch/${unpublishedChapterSlug}`);

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("clicking course link in popover navigates to course page", async ({ page }) => {
    await page.goto(chapterUrl);

    const triggerButton = page.getByRole("button", { name: chapterTitle });
    await triggerButton.click();

    const courseLink = page.getByRole("link", { exact: true, name: courseTitle });
    await expect(courseLink).toBeVisible();

    await courseLink.click({ force: true });

    await expect(page).toHaveURL(new RegExp(`/b/${AI_ORG_SLUG}/c/${courseSlug}$`));

    await expect(page.getByRole("heading", { level: 1, name: courseTitle })).toBeVisible();
  });
});

test.describe("Chapter Detail - Locale", () => {
  test("shows lessons in Portuguese for Portuguese locale", async ({ page }) => {
    await page.goto(ptChapterUrl);

    await expect(page.getByRole("link", { name: ptLessonNames.first })).toBeVisible();
    await expect(page.getByRole("link", { name: ptLessonNames.second })).toBeVisible();
  });
});

test.describe("Chapter Lesson Search", () => {
  test("filters lessons by title", async ({ page }) => {
    await page.goto(chapterUrl);

    await page.getByLabel(/search lessons/i).fill("History");

    await expect(page.getByRole("link", { name: lessonNames.second })).toBeVisible();

    await expect(page.getByRole("link", { name: lessonNames.first })).not.toBeVisible();
  });

  test("shows empty state when no matches found", async ({ page }) => {
    await page.goto(chapterUrl);

    await page.getByLabel(/search lessons/i).fill("nonexistent xyz");

    await expect(page.getByText(/no lessons found/i)).toBeVisible();
  });

  test("clears search and shows all lessons again", async ({ page }) => {
    await page.goto(chapterUrl);

    const searchInput = page.getByLabel(/search lessons/i);
    await searchInput.fill("History");

    await expect(page.getByRole("link", { name: lessonNames.first })).not.toBeVisible();

    await searchInput.clear();

    await expect(page.getByRole("link", { name: lessonNames.first })).toBeVisible();
    await expect(page.getByRole("link", { name: lessonNames.second })).toBeVisible();
  });
});

test.describe("Chapter - No Lessons", () => {
  test("chapter with no lessons redirects to generate page", async ({ page }) => {
    await page.goto(noLessonsChapterUrl);

    await expect(page).toHaveURL(new RegExp(`/generate/ch/${noLessonsChapterId}`));
  });
});
