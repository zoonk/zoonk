import { type APIRequestContext } from "@playwright/test";
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
import { expect, test } from "./fixtures";

/**
 * Course content can be opened through any UI locale, but search engines need
 * one stable URL based on the language of the content itself.
 */
async function expectCatalogMetadata({
  canonicalPath,
  request,
  path,
  robots,
}: {
  canonicalPath: string;
  request: APIRequestContext;
  path: string;
  robots: "index, follow" | "noindex, follow";
}) {
  const response = await request.get(path);
  expect(response.status(), path).toBe(200);
  const html = await response.text();
  const canonicalUrl = /<link rel="canonical" href="(?<url>[^"]+)"/u.exec(html)?.groups?.url;
  const actualRobots = /<meta name="robots" content="(?<value>[^"]+)"/u.exec(html)?.groups?.value;

  expect({ canonicalUrl, robots: actualRobots }, path).toStrictEqual({
    canonicalUrl: `${SITE_URL}${canonicalPath}`,
    robots,
  });
}

/**
 * A published course whose outline has one chapter with one lesson, all in the course language.
 * Without `details`, it's a shared course whose page details (its description first) aren't
 * written yet.
 */
async function createLibraryCourse({
  details = true,
  language,
}: {
  details?: boolean;
  language: string;
}) {
  const organization = await getAiOrganization();

  const course = await courseFixture({
    ...(!details && { description: null }),
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

test("marks course discovery pages as indexable", async ({ request }) => {
  for (const path of ["/courses", "/pt/courses/science"]) {
    // oxlint-disable-next-line no-await-in-loop -- Each response is checked before the next request.
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    // oxlint-disable-next-line no-await-in-loop -- Each response is checked before the next request.
    expect(await response.text(), path).toContain('<meta name="robots" content="index, follow"');
  }
});

test("indexes course, chapter, and lesson pages only in the course language", async ({
  request,
}) => {
  const { chapterPath, coursePath, lessonPath } = await createLibraryCourse({ language: "pt-BR" });

  await expectCatalogMetadata({
    canonicalPath: `/pt${coursePath}`,
    path: coursePath,
    request,
    robots: "noindex, follow",
  });

  await expectCatalogMetadata({
    canonicalPath: `/pt${chapterPath}`,
    path: `/es${chapterPath}`,
    request,
    robots: "noindex, follow",
  });

  await expectCatalogMetadata({
    canonicalPath: `/pt${lessonPath}`,
    path: `/fr${lessonPath}`,
    request,
    robots: "noindex, follow",
  });

  await expectCatalogMetadata({
    canonicalPath: `/pt${coursePath}`,
    path: `/pt${coursePath}`,
    request,
    robots: "index, follow",
  });

  await expectCatalogMetadata({
    canonicalPath: `/pt${chapterPath}`,
    path: `/pt${chapterPath}`,
    request,
    robots: "index, follow",
  });

  await expectCatalogMetadata({
    canonicalPath: `/pt${lessonPath}`,
    path: `/pt${lessonPath}`,
    request,
    robots: "index, follow",
  });
});

test("keeps a course and its pages out of the index until its page details are written", async ({
  request,
}) => {
  const { chapterPath, coursePath, lessonPath } = await createLibraryCourse({
    details: false,
    language: "pt-BR",
  });

  for (const path of [coursePath, chapterPath, lessonPath]) {
    // oxlint-disable-next-line no-await-in-loop -- One page opens each URL in turn.
    await expectCatalogMetadata({
      canonicalPath: `/pt${path}`,
      path: `/pt${path}`,
      request,
      robots: "noindex, follow",
    });
  }
});

test("keeps unsupported instructional languages out of the English index", async ({ request }) => {
  const { chapterPath, coursePath, lessonPath } = await createLibraryCourse({ language: "ja-JP" });

  await expectCatalogMetadata({
    canonicalPath: coursePath,
    path: coursePath,
    request,
    robots: "noindex, follow",
  });

  await expectCatalogMetadata({
    canonicalPath: chapterPath,
    path: chapterPath,
    request,
    robots: "noindex, follow",
  });

  await expectCatalogMetadata({
    canonicalPath: lessonPath,
    path: lessonPath,
    request,
    robots: "noindex, follow",
  });
});

test.describe("catalog URLs with another language preference", () => {
  test.use({ locale: "pt-BR" });

  test("uses the preferred UI language while keeping the course canonical", async ({ page }) => {
    const { course, coursePath: path } = await createLibraryCourse({ language: "en" });

    await setLocale(page, "de");

    await expectCatalogMetadata({
      canonicalPath: path,
      path,
      request: page.request,
      robots: "noindex, follow",
    });

    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(`/de${path}`);

    await expectCatalogMetadata({
      canonicalPath: path,
      path: `/pt${path}`,
      request: page.request,
      robots: "noindex, follow",
    });

    await page.goto(`/pt${path}`);

    expect(new URL(page.url()).pathname).toBe(`/pt${path}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt");
    await expect(page.getByRole("link", { name: "Montar meu plano" }).first()).toBeVisible();

    // Opening the Portuguese address doesn't change the saved language.
    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === LOCALE_COOKIE)?.value).toBe("de");

    await page.goto("/courses");
    await expect(page).toHaveURL(/\/de\/courses$/u);
  });
});
