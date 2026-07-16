import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { SITE_URL } from "@zoonk/utils/url";
import { type Page, expect, test } from "./fixtures";

/**
 * Course content can be opened through any UI locale, but search engines need
 * one stable URL based on the language of the content itself.
 */
async function expectCanonicalUrl({
  canonicalPath,
  page,
  path,
}: {
  canonicalPath: string;
  page: Page;
  path: string;
}) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");

  const canonicalUrl = await page.evaluate(
    () => document.querySelector<HTMLLinkElement>("link[rel='canonical']")?.href ?? "",
  );

  expect(canonicalUrl).toBe(`${SITE_URL}${canonicalPath}`);
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

test("uses the course language for course, chapter, and lesson canonical URLs", async ({
  page,
}) => {
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

  await expectCanonicalUrl({ canonicalPath: `/pt${coursePath}`, page, path: coursePath });
  await expectCanonicalUrl({ canonicalPath: `/pt${chapterPath}`, page, path: `/es${chapterPath}` });
  await expectCanonicalUrl({ canonicalPath: `/pt${lessonPath}`, page, path: `/fr${lessonPath}` });
});
