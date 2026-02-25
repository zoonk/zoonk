import { randomUUID } from "node:crypto";
import { getAiOrganization, setLocale } from "@zoonk/e2e/helpers";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { normalizeString } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";

const uniqueId = randomUUID();

let courseUrl: string;
let ptCourseUrl: string;
let chapterNames: { first: string; second: string; third: string };
let ptChapterNames: { first: string; second: string };

test.beforeAll(async () => {
  const org = await getAiOrganization();

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

  // Create first chapter separately so we can add a lesson (prevents redirect to /generate)
  const firstChapter = await chapterFixture({
    courseId: enCourse.id,
    isPublished: true,
    normalizedTitle: normalizeString(chapterNames.first),
    organizationId: org.id,
    position: 0,
    slug: `e2e-alpha-${uniqueId}`,
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
      isPublished: true,
      normalizedTitle: normalizeString(chapterNames.second),
      organizationId: org.id,
      position: 1,
      slug: `e2e-beta-${uniqueId}`,
      title: chapterNames.second,
    }),
    chapterFixture({
      courseId: enCourse.id,
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
      normalizedTitle: normalizeString(`Unpublished Chapter ${uniqueId}`),
      organizationId: org.id,
      position: 3,
      slug: `e2e-unpublished-${uniqueId}`,
      title: `Unpublished Chapter ${uniqueId}`,
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
  test("displays chapters with position numbers as links", async ({ page }) => {
    await page.goto(courseUrl);

    await expect(page.getByText("01", { exact: true })).toBeVisible();
    await expect(page.getByText("02", { exact: true })).toBeVisible();
    await expect(page.getByText("03", { exact: true })).toBeVisible();

    await expect(page.getByRole("link", { name: chapterNames.first })).toBeVisible();
    await expect(page.getByRole("link", { name: chapterNames.second })).toBeVisible();
    await expect(page.getByRole("link", { name: chapterNames.third })).toBeVisible();
  });

  test("chapter link navigates to chapter page", async ({ page }) => {
    await page.goto(courseUrl);

    const chapterLink = page.getByRole("link", { name: chapterNames.first });
    await expect(chapterLink).toBeVisible();
    await chapterLink.click();

    await expect(page).toHaveURL(new RegExp(`${courseUrl}/ch/e2e-alpha-${uniqueId}`));

    await expect(page.getByRole("heading", { level: 1, name: chapterNames.first })).toBeVisible();
  });

  test("excludes unpublished chapters from the list", async ({ page }) => {
    await page.goto(courseUrl);

    await expect(page.getByRole("link", { name: chapterNames.first })).toBeVisible();
    await expect(
      page.getByRole("link", { name: `Unpublished Chapter ${uniqueId}` }),
    ).not.toBeVisible();
    await expect(page.getByText("04", { exact: true })).not.toBeVisible();
  });
});

test.describe("Course Chapters - Locale", () => {
  test("shows chapters in Portuguese for Portuguese locale", async ({ page }) => {
    await setLocale(page, "pt");
    await page.goto(ptCourseUrl);

    await expect(page.getByRole("link", { name: ptChapterNames.first })).toBeVisible();
    await expect(page.getByRole("link", { name: ptChapterNames.second })).toBeVisible();
  });
});

test.describe("Course Chapter Search", () => {
  test("filters chapters by title", async ({ page }) => {
    await page.goto(courseUrl);

    await page.getByLabel(/search chapters/i).fill("Gamma");

    await expect(page.getByRole("link", { name: chapterNames.third })).toBeVisible();
    await expect(page.getByRole("link", { name: chapterNames.first })).not.toBeVisible();
    await expect(page.getByRole("link", { name: chapterNames.second })).not.toBeVisible();
  });

  test("persists search in URL and survives page reload", async ({ page }) => {
    await page.goto(courseUrl);

    await page.getByLabel(/search chapters/i).fill("Gamma");
    await expect(page).toHaveURL(/\?q=Gamma/);

    await page.reload();

    await expect(page.getByLabel(/search chapters/i)).toHaveValue("Gamma");
    await expect(page.getByRole("link", { name: chapterNames.third })).toBeVisible();
  });

  test("shows empty state when no matches found", async ({ page }) => {
    await page.goto(courseUrl);

    await page.getByLabel(/search chapters/i).fill("nonexistent xyz");
    await expect(page.getByText(/no chapters found/i)).toBeVisible();
  });

  test("clears search and shows all chapters again", async ({ page }) => {
    await page.goto(courseUrl);

    const searchInput = page.getByLabel(/search chapters/i);
    await searchInput.fill("Gamma");
    await expect(page.getByRole("link", { name: chapterNames.first })).not.toBeVisible();

    await searchInput.clear();

    await expect(page.getByRole("link", { name: chapterNames.first })).toBeVisible();
    await expect(page.getByRole("link", { name: chapterNames.second })).toBeVisible();
    await expect(page.getByRole("link", { name: chapterNames.third })).toBeVisible();
  });

  test("matches Portuguese chapters without accents (accent-insensitive search)", async ({
    page,
  }) => {
    await setLocale(page, "pt");
    await page.goto(ptCourseUrl);

    await page.getByLabel(/buscar capítulos/i).fill("introducao");

    await expect(page.getByRole("link", { name: ptChapterNames.first })).toBeVisible();
    await expect(page.getByRole("link", { name: ptChapterNames.second })).not.toBeVisible();
  });
});
