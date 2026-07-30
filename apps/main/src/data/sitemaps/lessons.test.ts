import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { SITEMAP_BATCH_SIZE } from "./courses";
import { countSitemapLessons, listSitemapLessons } from "./lessons";

/**
 * Returns the final sitemap page index for the shared integration database.
 */
function lastPage(count: number): number {
  return Math.max(Math.ceil(count / SITEMAP_BATCH_SIZE) - 1, 0);
}

/**
 * Reads the final two pages because adding a newly indexable lesson kind can
 * move the pagination boundary across fixtures created in the same test.
 */
async function listLatestSitemapLessons(count: number) {
  const finalPage = lastPage(count);
  const firstPage = Math.max(finalPage - 1, 0);
  const pages = Array.from({ length: finalPage - firstPage + 1 }, (_, index) => firstPage + index);
  const lessons = await Promise.all(pages.map((page) => listSitemapLessons(page)));

  return lessons.flat();
}

describe(listSitemapLessons, () => {
  it("includes authored lessons and identifiable single-source companions", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const lessons = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        description: "Authored explanation description",
        generationStatus: "completed",
        isPublished: true,
        kind: "explanation",
        organizationId: organization.id,
        position: 0,
        title: "Authored explanation",
      }),
      lessonFixture({
        chapterId: chapter.id,
        description: null,
        generationStatus: "completed",
        isPublished: true,
        kind: "quiz",
        organizationId: organization.id,
        position: 1,
        title: null,
      }),
      lessonFixture({
        chapterId: chapter.id,
        description: "Authored vocabulary description",
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        organizationId: organization.id,
        position: 2,
        title: "Authored vocabulary",
      }),
      lessonFixture({
        chapterId: chapter.id,
        description: null,
        generationStatus: "completed",
        isPublished: true,
        kind: "translation",
        organizationId: organization.id,
        position: 3,
        title: null,
      }),
    ]);

    const count = await countSitemapLessons();
    const sitemapLessons = await listLatestSitemapLessons(count);
    const sitemapSlugs = sitemapLessons.map((lesson) => lesson.lessonSlug);

    expect(sitemapSlugs).toStrictEqual(
      expect.arrayContaining(lessons.map((lesson) => lesson.slug)),
    );
  });

  it("uses metadata rather than generation or chapter state", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const [firstChapter, gatedChapter] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        generationStatus: "pending",
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      chapterFixture({
        courseId: course.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const [pendingLesson, runningLesson, reviewLesson, readingLesson, gatedLesson, untitledLesson] =
      await Promise.all([
        lessonFixture({
          chapterId: firstChapter.id,
          generationStatus: "pending",
          isPublished: true,
          organizationId: organization.id,
          position: 0,
        }),
        lessonFixture({
          chapterId: firstChapter.id,
          generationStatus: "running",
          isPublished: true,
          organizationId: organization.id,
          position: 1,
        }),
        lessonFixture({
          chapterId: firstChapter.id,
          description: null,
          generationStatus: "completed",
          isPublished: true,
          kind: "review",
          organizationId: organization.id,
          position: 2,
          title: null,
        }),
        lessonFixture({
          chapterId: firstChapter.id,
          generationStatus: "completed",
          isPublished: true,
          kind: "reading",
          organizationId: organization.id,
          position: 3,
          title: null,
        }),
        lessonFixture({
          chapterId: gatedChapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: organization.id,
          position: 0,
        }),
        lessonFixture({
          chapterId: firstChapter.id,
          description: null,
          generationStatus: "completed",
          isPublished: true,
          organizationId: organization.id,
          position: 4,
          title: null,
        }),
      ]);

    const includedLessons = [pendingLesson, runningLesson, reviewLesson, gatedLesson];
    const excludedLessons = [readingLesson, untitledLesson];

    const count = await countSitemapLessons();
    const sitemapLessons = await listLatestSitemapLessons(count);
    const sitemapSlugs = sitemapLessons.map((lesson) => lesson.lessonSlug);

    expect(sitemapSlugs).toStrictEqual(
      expect.arrayContaining(includedLessons.map((lesson) => lesson.slug)),
    );

    for (const lesson of excludedLessons) {
      expect(sitemapSlugs).not.toContain(lesson.slug);
    }
  });

  it("excludes lessons outside the published brand catalog", async () => {
    const [brandOrganization, personalOrganization] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "personal" }),
    ]);

    const [unpublishedCourse, personalCourse] = await Promise.all([
      courseFixture({ isPublished: false, organizationId: brandOrganization.id }),
      courseFixture({ isPublished: true, organizationId: personalOrganization.id }),
    ]);

    const [unpublishedChapter, personalChapter] = await Promise.all([
      chapterFixture({
        courseId: unpublishedCourse.id,
        isPublished: true,
        organizationId: brandOrganization.id,
        position: 0,
      }),
      chapterFixture({
        courseId: personalCourse.id,
        isPublished: true,
        organizationId: personalOrganization.id,
        position: 0,
      }),
    ]);

    const lessons = await Promise.all([
      lessonFixture({
        chapterId: unpublishedChapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: brandOrganization.id,
      }),
      lessonFixture({
        chapterId: personalChapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: personalOrganization.id,
      }),
    ]);

    const count = await countSitemapLessons();
    const sitemapLessons = await listLatestSitemapLessons(count);
    const sitemapSlugs = sitemapLessons.map((lesson) => lesson.lessonSlug);

    for (const lesson of lessons) {
      expect(sitemapSlugs).not.toContain(lesson.slug);
    }
  });
});
