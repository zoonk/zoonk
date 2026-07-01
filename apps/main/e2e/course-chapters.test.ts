import { randomUUID } from "node:crypto";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture, courseUserFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { getSearchInputTop, scrollSearchInputToTop } from "./catalog-search";
import { expect, test } from "./fixtures";

const SEARCH_CHAPTERS_LABEL = /search chapters/iu;
let courseUrl: string;
let ptCourseUrl: string;
let chapterSlugs: { first: string };
let chapterNames: { first: string; second: string; third: string };
let chapterDescriptions: { first: string; second: string; third: string };
let ptChapterNames: { first: string; second: string };
let unpublishedChapterName: string;

test.beforeAll(async ({ withProgressUser }) => {
  const org = await getAiOrganization();
  const uniqueId = randomUUID();

  const enCourse = await courseFixture({
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString(`E2E Chapters Course ${uniqueId}`),
    organizationId: org.id,
    slug: `e2e-chapters-course-${uniqueId}`,
    title: `E2E Chapters Course ${uniqueId}`,
  });

  chapterNames = {
    first: `Alpha Chapter ${uniqueId}`,
    second: `Beta Chapter ${uniqueId}`,
    third: `Gamma Chapter ${uniqueId}`,
  };

  chapterDescriptions = {
    first: `Alpha description ${uniqueId}`,
    second: `Beta description ${uniqueId}`,
    third: `Hidden orbital keyword ${uniqueId}`,
  };

  chapterSlugs = { first: `e2e-alpha-${uniqueId}` };
  unpublishedChapterName = `Unpublished Chapter ${uniqueId}`;

  // Create first chapter separately so we can add a lesson (prevents redirect to /generate)
  const firstChapter = await chapterFixture({
    courseId: enCourse.id,
    description: chapterDescriptions.first,
    isPublished: true,
    normalizedTitle: normalizeString(chapterNames.first),
    organizationId: org.id,
    position: 0,
    slug: chapterSlugs.first,
    title: chapterNames.first,
  });

  await lessonFixture({
    chapterId: firstChapter.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-alpha-lesson-${uniqueId}`,
    title: `Alpha Lesson ${uniqueId}`,
  });

  await Promise.all([
    chapterFixture({
      courseId: enCourse.id,
      description: chapterDescriptions.second,
      isPublished: true,
      normalizedTitle: normalizeString(chapterNames.second),
      organizationId: org.id,
      position: 1,
      slug: `e2e-beta-${uniqueId}`,
      title: chapterNames.second,
    }),
    chapterFixture({
      courseId: enCourse.id,
      description: chapterDescriptions.third,
      isPublished: true,
      normalizedTitle: normalizeString(chapterNames.third),
      organizationId: org.id,
      position: 2,
      slug: `e2e-gamma-${uniqueId}`,
      title: chapterNames.third,
    }),
    chapterFixture({
      courseId: enCourse.id,
      isPublished: false,
      normalizedTitle: normalizeString(unpublishedChapterName),
      organizationId: org.id,
      position: 3,
      slug: `e2e-unpublished-${uniqueId}`,
      title: unpublishedChapterName,
    }),
  ]);

  courseUrl = `/b/${AI_ORG_SLUG}/c/${enCourse.slug}`;

  // Portuguese course + chapters
  const ptCourse = await courseFixture({
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString(`E2E Capítulos Curso ${uniqueId}`),
    organizationId: org.id,
    slug: `e2e-capitulos-curso-${uniqueId}`,
    title: `E2E Capítulos Curso ${uniqueId}`,
  });

  ptChapterNames = {
    first: `Introdução ao Teste ${uniqueId}`,
    second: `Preparação de Teste ${uniqueId}`,
  };

  await Promise.all([
    courseUserFixture({ courseId: enCourse.id, userId: withProgressUser.id }),
    courseUserFixture({ courseId: ptCourse.id, userId: withProgressUser.id }),
    chapterFixture({
      courseId: ptCourse.id,
      isPublished: true,
      language: "pt",
      normalizedTitle: normalizeString(ptChapterNames.first),
      organizationId: org.id,
      position: 0,
      slug: `e2e-intro-pt-${uniqueId}`,
      title: ptChapterNames.first,
    }),
    chapterFixture({
      courseId: ptCourse.id,
      isPublished: true,
      language: "pt",
      normalizedTitle: normalizeString(ptChapterNames.second),
      organizationId: org.id,
      position: 1,
      slug: `e2e-prep-pt-${uniqueId}`,
      title: ptChapterNames.second,
    }),
  ]);

  ptCourseUrl = `/b/${AI_ORG_SLUG}/c/${ptCourse.slug}`;
});

test.describe("Course Chapters List", () => {
  test("displays chapter rows", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto(courseUrl);

    await expect(
      page.getByRole("link", { name: new RegExp(chapterNames.first, "u") }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: new RegExp(chapterNames.second, "u") }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: new RegExp(chapterNames.third, "u") }),
    ).toBeVisible();
  });

  test("chapter link navigates to chapter page", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto(courseUrl);

    const chapterLink = page.getByRole("link", { name: new RegExp(chapterNames.first, "u") });

    await expect(chapterLink).toBeVisible();
    await chapterLink.click();

    await expect(page).toHaveURL(new RegExp(`${courseUrl}/ch/${chapterSlugs.first}`, "u"));

    await expect(page.getByRole("heading", { level: 1, name: chapterNames.first })).toBeVisible();
  });

  test("excludes unpublished chapters from the list", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto(courseUrl);

    await expect(
      page.getByRole("link", { name: new RegExp(chapterNames.first, "u") }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: new RegExp(unpublishedChapterName, "u") }),
    ).not.toBeVisible();
  });
});

test.describe("Course Chapters - Locale", () => {
  test("shows chapters in Portuguese for Portuguese locale", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await setLocale(page, "pt");
    await page.goto(ptCourseUrl);

    await expect(
      page.getByRole("link", { name: new RegExp(ptChapterNames.first, "u") }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: new RegExp(ptChapterNames.second, "u") }),
    ).toBeVisible();
  });
});

test.describe("Course Chapter Search", () => {
  test("filters chapters by title", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto(courseUrl);

    await page.getByLabel(/search chapters/iu).fill("Gamma");

    const firstChapter = page.getByRole("link", { name: new RegExp(chapterNames.first, "u") });
    const secondChapter = page.getByRole("link", { name: new RegExp(chapterNames.second, "u") });
    const thirdChapter = page.getByRole("link", { name: new RegExp(chapterNames.third, "u") });

    await expect(thirdChapter).toBeVisible();
    await expect(firstChapter).not.toBeVisible();
    await expect(secondChapter).not.toBeVisible();
  });

  test("filters chapters by description", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto(courseUrl);

    await page.getByLabel(/search chapters/iu).fill("orbital keyword");

    const firstChapter = page.getByRole("link", { name: new RegExp(chapterNames.first, "u") });
    const secondChapter = page.getByRole("link", { name: new RegExp(chapterNames.second, "u") });
    const thirdChapter = page.getByRole("link", { name: new RegExp(chapterNames.third, "u") });

    await expect(thirdChapter).toBeVisible();
    await expect(firstChapter).not.toBeVisible();
    await expect(secondChapter).not.toBeVisible();
  });

  test("persists search in URL and survives page reload", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto(courseUrl);

    await page.getByLabel(/search chapters/iu).fill("Gamma");
    await expect(page).toHaveURL(/\?q=Gamma/u);

    await page.reload();

    await expect(page.getByLabel(/search chapters/iu)).toHaveValue("Gamma");

    await expect(
      page.getByRole("link", { name: new RegExp(chapterNames.third, "u") }),
    ).toBeVisible();
  });

  test("shows empty state when no matches found", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto(courseUrl);

    await page.getByLabel(/search chapters/iu).fill("nonexistent xyz");
    await expect(page.getByText(/no chapters found/iu)).toBeVisible();
  });

  test("clears search and shows all chapters again", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto(courseUrl);

    const searchInput = page.getByLabel(/search chapters/iu);
    const firstChapter = page.getByRole("link", { name: new RegExp(chapterNames.first, "u") });
    const secondChapter = page.getByRole("link", { name: new RegExp(chapterNames.second, "u") });
    const thirdChapter = page.getByRole("link", { name: new RegExp(chapterNames.third, "u") });

    await searchInput.fill("Gamma");
    await expect(firstChapter).not.toBeVisible();

    await searchInput.clear();

    await expect(firstChapter).toBeVisible();
    await expect(secondChapter).toBeVisible();
    await expect(thirdChapter).toBeVisible();
  });

  test("matches Portuguese chapters without accents (accent-insensitive search)", async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    await setLocale(page, "pt");
    await page.goto(ptCourseUrl);

    await page.getByLabel(/buscar capítulos/iu).fill("introducao");

    const firstChapter = page.getByRole("link", { name: new RegExp(ptChapterNames.first, "u") });
    const secondChapter = page.getByRole("link", { name: new RegExp(ptChapterNames.second, "u") });

    await expect(firstChapter).toBeVisible();
    await expect(secondChapter).not.toBeVisible();
  });
});

test.describe("Course Chapter Search - Mobile", () => {
  test.use({ viewport: { height: 667, width: 375 } });

  test("keeps the search field anchored when no chapters match", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto(courseUrl);
    await scrollSearchInputToTop({ label: SEARCH_CHAPTERS_LABEL, page });

    const searchInput = page.getByLabel(SEARCH_CHAPTERS_LABEL);

    await searchInput.fill("Chapter");

    await expect(
      page.getByRole("link", { name: new RegExp(chapterNames.third, "u") }),
    ).toBeVisible();

    const matchingTop = await getSearchInputTop({ label: SEARCH_CHAPTERS_LABEL, page });

    await searchInput.fill("nonexistent xyz");
    await expect(page.getByText(/no chapters found/iu)).toBeVisible();

    await expect
      .poll(() => getSearchInputTop({ label: SEARCH_CHAPTERS_LABEL, page }))
      .toBeLessThanOrEqual(matchingTop + 1);
  });
});
