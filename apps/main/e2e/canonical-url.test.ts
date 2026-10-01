import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
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

/** A published course whose outline has one chapter with one lesson, all in the course language. */
async function createLibraryCourse({ language }: { language: string }) {
  const organization = await getAiOrganization();

  const course = await courseFixture({
    isPublished: true,
    language,
    organizationId: organization.id,
  });

  const chapter = await libraryChapterFixture({ homeCourseId: course.id, language });
  const lesson = await libraryLessonFixture({ homeChapterId: chapter.id, language });

  await Promise.all([
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
  ]);

  const coursePath = `/b/${organization.slug}/c/${course.slug}`;
  const chapterPath = `${coursePath}/ch/${chapter.slug}`;

  return { chapterPath, course, coursePath, lessonPath: `${chapterPath}/l/${lesson.slug}` };
}

test("marks course discovery pages as indexable", async ({ page }) => {
  await expectIndexable({ page, path: "/courses" });
  await expectIndexable({ page, path: "/pt/courses/science" });
});

test("indexes course, chapter, and lesson pages only in the course language", async ({ page }) => {
  const { chapterPath, coursePath, lessonPath } = await createLibraryCourse({ language: "pt-BR" });

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
  const { chapterPath, coursePath, lessonPath } = await createLibraryCourse({ language: "ja-JP" });

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

  test("uses the preferred UI language while keeping the course canonical", async ({ page }) => {
    const { course, coursePath: path } = await createLibraryCourse({ language: "en" });

    await setLocale(page, "de");
    await expectCatalogMetadata({ canonicalPath: path, page, path, robots: "noindex, follow" });
    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(`/de${path}`);

    await expectCatalogMetadata({
      canonicalPath: path,
      page,
      path: `/pt${path}`,
      robots: "noindex, follow",
    });

    expect(new URL(page.url()).pathname).toBe(`/pt${path}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt");
    await expect(page.getByRole("button", { name: "Começar este curso" }).first()).toBeVisible();

    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === LOCALE_COOKIE)?.value).toBe("pt");

    await page.goto("/courses");
    await expect(page).toHaveURL(/\/pt\/courses$/u);
  });
});
