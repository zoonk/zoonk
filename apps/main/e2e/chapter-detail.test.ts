import { randomUUID } from "node:crypto";
import { type Browser, type Page } from "@playwright/test";
import { type LessonKind, prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
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
let courseUrl: string;
let courseSlug: string;
let courseTitle: string;
let chapterTitle: string;
let unpublishedChapterSlug: string;
let noLessonsChapterId: string;
let noLessonsChapterUrl: string;
let lessonNames: { first: string; second: string };
let lessonDescriptions: { first: string; second: string };
let lessonSlugs: { first: string; second: string };
let languageChapterUrl: string;
let ptChapterUrl: string;
let ptLessonNames: { first: string; second: string };

/**
 * Lesson type filters are saved to the user profile, so filter tests need a
 * dedicated user instead of the shared worker auth fixture that parallel tests
 * may also be using.
 */
async function createFilterTestPage({ browser }: { browser: Browser }) {
  const user = await createE2EUser(getBaseURL(), { orgRole: "member" });
  const context = await browser.newContext({ storageState: user.storageState });
  const page = await context.newPage();

  return { context, page, user };
}

async function getSavedHiddenLessonKinds(userId: string) {
  const profile = await prisma.userLearningProfile.findUnique({
    select: { preferences: true },
    where: { userId },
  });

  const preferences = profile?.preferences;

  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
    return [];
  }

  const hiddenLessonKinds = (preferences as { hiddenLessonKinds?: unknown }).hiddenLessonKinds;

  return Array.isArray(hiddenLessonKinds)
    ? hiddenLessonKinds.filter((kind): kind is LessonKind => typeof kind === "string")
    : [];
}

async function expectSavedHiddenLessonKinds({
  hiddenLessonKinds,
  userId,
}: {
  hiddenLessonKinds: LessonKind[];
  userId: string;
}) {
  await expect.poll(() => getSavedHiddenLessonKinds(userId)).toEqual(hiddenLessonKinds);
}

/**
 * The filter menu is rendered through a portal, so tests should wait for the
 * trigger and the menu label before checking specific checkbox items.
 */
async function openLessonTypeFilterMenu({ page }: { page: Page }) {
  const filterButton = page.getByRole("button", { name: /filter lesson types/iu });

  await expect(filterButton).toBeVisible();
  await expect(filterButton).toBeEnabled();
  await filterButton.click();
  await expect(page.getByText(/show lesson types/iu)).toBeVisible();

  return filterButton;
}

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

  courseUrl = `/b/${AI_ORG_SLUG}/c/${courseSlug}`;
  chapterUrl = `${courseUrl}/ch/${chapterSlug}`;

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
      kind: "quiz",
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

  const languageCourse = await courseFixture({
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString(`E2E Language Course ${uniqueId}`),
    organizationId: org.id,
    slug: `e2e-language-course-${uniqueId}`,
    targetLanguage: "es",
    title: `E2E Language Course ${uniqueId}`,
  });

  const languageChapter = await chapterFixture({
    courseId: languageCourse.id,
    description: `Language learning chapter ${uniqueId}`,
    isPublished: true,
    normalizedTitle: normalizeString(`E2E Language Chapter ${uniqueId}`),
    organizationId: org.id,
    position: 0,
    slug: `e2e-language-ch-${uniqueId}`,
    title: `E2E Language Chapter ${uniqueId}`,
  });

  languageChapterUrl = `/b/${AI_ORG_SLUG}/c/${languageCourse.slug}/ch/${languageChapter.slug}`;

  await Promise.all([
    lessonFixture({
      chapterId: languageChapter.id,
      isPublished: true,
      kind: "vocabulary",
      organizationId: org.id,
      position: 0,
      title: `Spanish Words ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: languageChapter.id,
      isPublished: true,
      kind: "grammar",
      organizationId: org.id,
      position: 1,
      title: `Spanish Grammar ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: languageChapter.id,
      isPublished: true,
      kind: "quiz",
      organizationId: org.id,
      position: 2,
      title: `Language Quiz ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: languageChapter.id,
      isPublished: true,
      kind: "explanation",
      organizationId: org.id,
      position: 3,
      title: `Language Explanation ${uniqueId}`,
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

test.describe("Chapter Navbar - Mobile", () => {
  test.use({ viewport: { height: 667, width: 375 } });

  test("shows only course back and home close links", async ({ page }) => {
    await page.goto(chapterUrl);

    const catalogNavbar = page.getByRole("navigation").first();
    const courseLink = catalogNavbar.getByRole("link", { name: /course page/iu });
    const homeLink = catalogNavbar.getByRole("link", { name: /home page/iu });

    await expect(courseLink).toBeVisible();
    await expect(courseLink).toHaveAttribute("href", courseUrl);

    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute("href", "/");

    await expect(page.getByRole("main").getByRole("link", { name: courseTitle })).not.toBeVisible();

    await expect(
      catalogNavbar.getByRole("link", { exact: true, name: "Courses" }),
    ).not.toBeVisible();

    await expect(catalogNavbar.getByRole("button", { name: /search/iu })).not.toBeVisible();
    await expect(catalogNavbar.getByRole("button", { name: /user menu/iu })).not.toBeVisible();
  });
});

test.describe("Chapter Navbar - Desktop", () => {
  test("keeps catalog actions without the Courses link", async ({ page }) => {
    await page.goto(chapterUrl);

    const catalogNavbar = page.getByRole("navigation").first();

    await expect(
      catalogNavbar.getByRole("link", { exact: true, name: "Courses" }),
    ).not.toBeVisible();

    await expect(catalogNavbar.getByRole("button", { name: /search/iu })).toBeVisible();
    await expect(catalogNavbar.getByRole("link", { name: /course page/iu })).not.toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: courseTitle })).toBeVisible();
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

  test("persists search in URL and survives page reload", async ({ page }) => {
    await page.goto(chapterUrl);

    await page.getByLabel(/search lessons/iu).fill("History");
    await expect(page).toHaveURL(/\?q=History/u);

    await page.reload();

    await expect(page.getByLabel(/search lessons/iu)).toHaveValue("History");

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

test.describe("Chapter Lesson Type Filters", () => {
  test("lets guests hide lesson types locally without a save error", async ({ page }) => {
    await page.goto(chapterUrl);

    await openLessonTypeFilterMenu({ page });
    await expect(page.getByRole("menuitemcheckbox", { name: /^explanation$/iu })).toBeVisible();
    await expect(page.getByRole("menuitemcheckbox", { name: /^quiz$/iu })).toBeVisible();
    await expect(page.getByRole("menuitemcheckbox", { name: /^grammar$/iu })).not.toBeVisible();
    await expect(page.getByRole("menuitemcheckbox", { name: /^vocabulary$/iu })).not.toBeVisible();
    await page.getByRole("menuitemcheckbox", { name: /^quiz$/iu }).click();

    await expect(
      page.getByRole("link", { name: new RegExp(lessonNames.first, "u") }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: new RegExp(lessonNames.second, "u") }),
    ).not.toBeVisible();

    await expect(page.getByRole("menuitem", { name: /clear filter/iu })).toBeVisible();
    await expect(page.getByText(/could not update lesson filters/iu)).not.toBeVisible();
  });

  test("shows only language lesson types for language courses", async ({ page }) => {
    await page.goto(languageChapterUrl);

    await openLessonTypeFilterMenu({ page });

    await expect(page.getByRole("menuitemcheckbox", { name: /^grammar$/iu })).toBeVisible();
    await expect(page.getByRole("menuitemcheckbox", { name: /^vocabulary$/iu })).toBeVisible();
    await expect(page.getByRole("menuitemcheckbox", { name: /^explanation$/iu })).not.toBeVisible();
    await expect(page.getByRole("menuitemcheckbox", { name: /^quiz$/iu })).not.toBeVisible();
  });

  test("hides lesson types and clears filters from the filter menu", async ({ browser }) => {
    const { context, page } = await createFilterTestPage({ browser });

    await page.goto(chapterUrl);

    const filterButton = await openLessonTypeFilterMenu({ page });
    const quizFilterItem = page.getByRole("menuitemcheckbox", { name: /^quiz$/iu });

    await quizFilterItem.click();

    await expect(
      page.getByRole("link", { name: new RegExp(lessonNames.first, "u") }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: new RegExp(lessonNames.second, "u") }),
    ).not.toBeVisible();

    const clearFilterItem = page.getByRole("menuitem", { name: /clear filter/iu });

    await expect(quizFilterItem).toBeEnabled();
    await expect(clearFilterItem).toBeEnabled();
    await expect(filterButton).toBeEnabled();

    await clearFilterItem.click();

    await expect(
      page.getByRole("link", { name: new RegExp(lessonNames.second, "u") }),
    ).toBeVisible();

    await expect(filterButton).toBeEnabled();

    await context.close();
  });

  test("persists hidden lesson types for the user", async ({ browser }) => {
    const { context, page, user } = await createFilterTestPage({ browser });

    await page.goto(chapterUrl);

    await openLessonTypeFilterMenu({ page });
    await page.getByRole("menuitemcheckbox", { name: /^quiz$/iu }).click();
    await expectSavedHiddenLessonKinds({ hiddenLessonKinds: ["quiz"], userId: user.id });

    const secondContext = await browser.newContext({ storageState: user.storageState });
    const secondPage = await secondContext.newPage();

    await secondPage.goto(chapterUrl);

    await expect(
      secondPage.getByRole("link", { name: new RegExp(lessonNames.second, "u") }),
    ).not.toBeVisible();

    await openLessonTypeFilterMenu({ page: secondPage });

    const clearFilterItem = secondPage.getByRole("menuitem", { name: /clear filter/iu });

    await expect(clearFilterItem).toBeEnabled();

    await clearFilterItem.click();
    await expectSavedHiddenLessonKinds({ hiddenLessonKinds: [], userId: user.id });

    await expect(
      secondPage.getByRole("link", { name: new RegExp(lessonNames.second, "u") }),
    ).toBeVisible();

    await Promise.all([context.close(), secondContext.close()]);
  });
});

test.describe("Chapter - No Lessons", () => {
  test("AI chapter with no lessons shows a create chapter link", async ({ page }) => {
    await page.goto(noLessonsChapterUrl);

    await expect(page).toHaveURL(noLessonsChapterUrl);
    await expect(page.getByText(/create this chapter/iu)).toBeVisible();
    await expect(page.getByText(/create it to see all of its lessons/iu)).toBeVisible();

    const generateLink = page.getByRole("link", { name: /create chapter/iu });

    await expect(generateLink).toBeVisible();

    await expect(generateLink).toHaveAttribute(
      "href",
      new RegExp(`/generate/ch/${noLessonsChapterId}`, "u"),
    );

    await expect(generateLink).toHaveAttribute("rel", "nofollow");

    const actionsButton = page.getByRole("main").getByRole("button", { name: /more options/iu });

    await expect(actionsButton).toHaveCount(0);
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
