import { randomUUID } from "node:crypto";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { getSearchInputTop, scrollSearchInputToTop } from "./catalog-search";
import { expect, test } from "./fixtures";

const uniqueId = randomUUID();
const SEARCH_LESSONS_LABEL = /search lessons/iu;

let chapterUrl: string;
let courseSlug: string;
let courseTitle: string;
let chapterTitle: string;
let unpublishedChapterSlug: string;
let noLessonsChapterId: string;
let noLessonsChapterUrl: string;
let lessonNames: { first: string; second: string };
let lessonDescriptions: { first: string; second: string };
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

  lessonDescriptions = {
    first: `Practical setup ${uniqueId}`,
    second: `Hidden archive keyword ${uniqueId}`,
  };

  lessonSlugs = { first: `e2e-what-is-${uniqueId}`, second: `e2e-history-of-${uniqueId}` };

  const unpublishedLessonTitle = `Unpublished Lesson ${uniqueId}`;

  await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      description: lessonDescriptions.first,
      isPublished: true,
      normalizedTitle: normalizeString(lessonNames.first),
      organizationId: org.id,
      position: 0,
      slug: lessonSlugs.first,
      title: lessonNames.first,
    }),
    lessonFixture({
      chapterId: chapter.id,
      description: lessonDescriptions.second,
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

  ptChapterUrl = `/b/${AI_ORG_SLUG}/c/${ptCourse.slug}/ch/${ptChapter.slug}`;

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
  test("shows chapter content with title, description, and image", async ({ page }) => {
    await page.goto(chapterUrl);

    await expect(
      page.getByRole("heading", { exact: true, level: 1, name: `1. ${chapterTitle}` }),
    ).toBeVisible();

    await expect(page.getByText(`Different types of learning ${uniqueId}`)).toBeVisible();

    await expect(page.getByRole("img", { exact: true, name: chapterTitle })).toBeVisible();
  });

  test("displays lesson rows", async ({ page }) => {
    await page.goto(chapterUrl);

    await expect(
      page.getByRole("link", { name: new RegExp(lessonNames.first, "u") }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: new RegExp(lessonNames.second, "u") }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: new RegExp(`Unpublished Lesson ${uniqueId}`, "u") }),
    ).not.toBeVisible();
  });

  test("lesson link navigates to the correct URL", async ({ page }) => {
    await page.goto(chapterUrl);

    const lessonLink = page.getByRole("link", { name: new RegExp(lessonNames.first, "u") });
    await expect(lessonLink).toBeVisible();

    await lessonLink.click();

    await expect(page).toHaveURL(new RegExp(`${chapterUrl}/l/${lessonSlugs.first}`, "u"));
  });

  test("non-existent chapter shows 404 page", async ({ page }) => {
    await page.goto(`/b/${AI_ORG_SLUG}/c/${courseSlug}/ch/nonexistent-chapter-${uniqueId}`);

    await expect(page.getByText(/not found|404/iu)).toBeVisible();
  });

  test("unpublished chapter shows 404 page", async ({ page }) => {
    await page.goto(`/b/${AI_ORG_SLUG}/c/${courseSlug}/ch/${unpublishedChapterSlug}`);

    await expect(page.getByText(/not found|404/iu)).toBeVisible();
  });
});

test.describe("Chapter Detail - Locale", () => {
  test("shows lessons in Portuguese for Portuguese locale", async ({ page }) => {
    await page.goto(ptChapterUrl);

    await expect(
      page.getByRole("link", { name: new RegExp(ptLessonNames.first, "u") }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: new RegExp(ptLessonNames.second, "u") }),
    ).toBeVisible();
  });
});

test.describe("Chapter Lesson Search", () => {
  test("filters lessons by title", async ({ page }) => {
    await page.goto(chapterUrl);

    await page.getByLabel(/search lessons/iu).fill("History");

    await expect(
      page.getByRole("link", { name: new RegExp(lessonNames.second, "u") }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: new RegExp(lessonNames.first, "u") }),
    ).not.toBeVisible();
  });

  test("filters lessons by description", async ({ page }) => {
    await page.goto(chapterUrl);

    await page.getByLabel(/search lessons/iu).fill("archive keyword");

    await expect(
      page.getByRole("link", { name: new RegExp(lessonNames.second, "u") }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: new RegExp(lessonNames.first, "u") }),
    ).not.toBeVisible();
  });

  test("shows empty state when no matches found", async ({ page }) => {
    await page.goto(chapterUrl);

    await page.getByLabel(/search lessons/iu).fill("nonexistent xyz");

    await expect(page.getByText(/no lessons found/iu)).toBeVisible();
  });

  test("clears search and shows all lessons again", async ({ page }) => {
    await page.goto(chapterUrl);

    const searchInput = page.getByLabel(/search lessons/iu);
    await searchInput.fill("History");

    await expect(
      page.getByRole("link", { name: new RegExp(lessonNames.first, "u") }),
    ).not.toBeVisible();

    await searchInput.clear();

    await expect(
      page.getByRole("link", { name: new RegExp(lessonNames.first, "u") }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: new RegExp(lessonNames.second, "u") }),
    ).toBeVisible();
  });
});

test.describe("Chapter Lesson Search - Mobile", () => {
  test.use({ viewport: { height: 667, width: 375 } });

  test("keeps the search field anchored when no lessons match", async ({ page }) => {
    await page.goto(chapterUrl);
    await scrollSearchInputToTop({ label: SEARCH_LESSONS_LABEL, page });

    const searchInput = page.getByLabel(SEARCH_LESSONS_LABEL);

    await searchInput.fill("E2E Testing");

    await expect(
      page.getByRole("link", { name: new RegExp(lessonNames.first, "u") }),
    ).toBeVisible();

    const matchingTop = await getSearchInputTop({ label: SEARCH_LESSONS_LABEL, page });

    await searchInput.fill("nonexistent xyz");
    await expect(page.getByText(/no lessons found/iu)).toBeVisible();

    await expect
      .poll(() => getSearchInputTop({ label: SEARCH_LESSONS_LABEL, page }))
      .toBeLessThanOrEqual(matchingTop + 1);
  });
});

test.describe("Chapter - No Lessons", () => {
  test("chapter with no lessons redirects to generate page", async ({ page }) => {
    await page.goto(noLessonsChapterUrl);

    await page.waitForURL(new RegExp(`/generate/ch/${noLessonsChapterId}`, "u"));
  });

  test("non-AI chapters with no lessons stay on the chapter page", async ({ page }) => {
    const nonAiUniqueId = randomUUID().slice(0, 8);
    const org = await createOrganization();

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-chapter-course-${nonAiUniqueId}`,
      title: `Non AI Chapter Course ${nonAiUniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      description: `Non AI chapter ${nonAiUniqueId}`,
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-chapter-${nonAiUniqueId}`,
      title: `Non AI Chapter ${nonAiUniqueId}`,
    });

    const url = `/b/${org.slug}/c/${course.slug}/ch/${chapter.slug}`;

    await page.goto(url);

    await expect(page).toHaveURL(url);

    await expect(
      page.getByRole("heading", { level: 1, name: `Non AI Chapter ${nonAiUniqueId}` }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: /^start$/iu })).not.toBeVisible();
  });
});
