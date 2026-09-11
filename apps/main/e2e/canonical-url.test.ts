import { randomUUID } from "node:crypto";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { LOCALE_COOKIE } from "@zoonk/utils/locale";
import { SITE_URL } from "@zoonk/utils/url";
import { type Page, expect, test } from "./fixtures";

/**
 * Course content can be opened through any UI locale, but search engines need
 * one stable URL based on the language of the content itself.
 */
async function expectCatalogMetadata({
  canonicalPath,
  page,
  path,
  robots,
}: {
  canonicalPath: string;
  page: Page;
  path: string;
  robots: "index, follow" | "noindex, follow";
}) {
  await page.goto(path);

  await expect
    .poll(() =>
      page.evaluate(() => ({
        canonicalUrl: document.querySelector<HTMLLinkElement>("link[rel='canonical']")?.href,
        robots: document.querySelector<HTMLMetaElement>("meta[name='robots']")?.content,
      })),
    )
    .toStrictEqual({ canonicalUrl: `${SITE_URL}${canonicalPath}`, robots });
}

/**
 * Course discovery pages are search landing pages, so their rendered metadata
 * should explicitly allow indexing instead of relying on an implicit default.
 */
async function expectIndexable({ page, path }: { page: Page; path: string }) {
  await page.goto(path);

  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelector<HTMLMetaElement>("meta[name='robots']")?.content ?? "",
      ),
    )
    .toBe("index, follow");
}

test("marks course discovery pages as indexable", async ({ page }) => {
  await expectIndexable({ page, path: "/courses" });
  await expectIndexable({ page, path: "/pt/courses/science" });
});

test("indexes course, chapter, and lesson pages only in the course language", async ({ page }) => {
  const uniqueId = randomUUID().slice(0, 8);
  const organization = await getAiOrganization();

  const course = await courseFixture({
    isPublished: true,
    language: "pt-BR",
    organizationId: organization.id,
    slug: `e2e-canonical-course-${uniqueId}`,
    title: `E2E Canonical Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    language: "pt-BR",
    organizationId: organization.id,
    slug: `e2e-canonical-chapter-${uniqueId}`,
    title: `E2E Canonical Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    language: "pt-BR",
    organizationId: organization.id,
    slug: `e2e-canonical-lesson-${uniqueId}`,
    title: `E2E Canonical Lesson ${uniqueId}`,
  });

  const coursePath = `/b/${organization.slug}/c/${course.slug}`;
  const chapterPath = `${coursePath}/ch/${chapter.slug}`;
  const lessonPath = `${chapterPath}/l/${lesson.slug}`;

  await expectCatalogMetadata({
    canonicalPath: `/pt${coursePath}`,
    page,
    path: coursePath,
    robots: "noindex, follow",
  });

  await expectCatalogMetadata({
    canonicalPath: `/pt${chapterPath}`,
    page,
    path: `/es${chapterPath}`,
    robots: "noindex, follow",
  });

  await expectCatalogMetadata({
    canonicalPath: `/pt${lessonPath}`,
    page,
    path: `/fr${lessonPath}`,
    robots: "noindex, follow",
  });

  await expectCatalogMetadata({
    canonicalPath: `/pt${coursePath}`,
    page,
    path: `/pt${coursePath}`,
    robots: "index, follow",
  });

  await expectCatalogMetadata({
    canonicalPath: `/pt${chapterPath}`,
    page,
    path: `/pt${chapterPath}`,
    robots: "index, follow",
  });

  await expectCatalogMetadata({
    canonicalPath: `/pt${lessonPath}`,
    page,
    path: `/pt${lessonPath}`,
    robots: "index, follow",
  });
});

test("keeps unsupported instructional languages out of the English index", async ({ page }) => {
  const organization = await getAiOrganization();

  const course = await courseFixture({
    isPublished: true,
    language: "ja-JP",
    organizationId: organization.id,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: organization.id,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    organizationId: organization.id,
  });

  const coursePath = `/b/${organization.slug}/c/${course.slug}`;
  const chapterPath = `${coursePath}/ch/${chapter.slug}`;
  const lessonPath = `${chapterPath}/l/${lesson.slug}`;

  await expectCatalogMetadata({
    canonicalPath: coursePath,
    page,
    path: coursePath,
    robots: "noindex, follow",
  });

  await expectCatalogMetadata({
    canonicalPath: chapterPath,
    page,
    path: chapterPath,
    robots: "noindex, follow",
  });

  await expectCatalogMetadata({
    canonicalPath: lessonPath,
    page,
    path: lessonPath,
    robots: "noindex, follow",
  });
});

test.describe("catalog URLs with another language preference", () => {
  test.use({ locale: "pt-BR" });

  test("keeps English canonicals stable while preserving the saved UI language", async ({
    page,
  }) => {
    const organization = await getAiOrganization();

    const course = await courseFixture({
      isPublished: true,
      language: "en",
      organizationId: organization.id,
    });

    await chapterFixture({
      courseId: course.id,
      isPublished: true,
      language: course.language,
      organizationId: organization.id,
    });

    const path = `/b/${organization.slug}/c/${course.slug}`;

    await setLocale(page, "de");
    await expectCatalogMetadata({ canonicalPath: path, page, path, robots: "index, follow" });
    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(path);

    await expectCatalogMetadata({
      canonicalPath: path,
      page,
      path: `/pt${path}`,
      robots: "noindex, follow",
    });

    expect(new URL(page.url()).pathname).toBe(`/pt${path}`);

    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === LOCALE_COOKIE)?.value).toBe("de");

    await page.goto("/courses");
    await expect(page).toHaveURL(/\/de\/courses$/u);
  });
});
