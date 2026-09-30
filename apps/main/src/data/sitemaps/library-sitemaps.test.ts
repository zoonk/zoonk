import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { SITEMAP_BATCH_SIZE } from "./courses";
import { countSitemapLibraryChapters, listSitemapLibraryChapters } from "./library-chapters";
import { countSitemapLibraryLessons, listSitemapLibraryLessons } from "./library-lessons";

/** Library ids are time-ordered, so rows a test just created are on the last sitemap page. */
function lastPage(count: number): number {
  return Math.max(Math.ceil(count / SITEMAP_BATCH_SIZE) - 1, 0);
}

async function homeChapter({ isPublished = true } = {}) {
  const org = await organizationFixture({ kind: "brand" });

  const course = await courseFixture({ isPublished, language: "pt", organizationId: org.id });

  const chapter = await libraryChapterFixture({ homeCourseId: course.id, language: "pt" });
  return { chapter, course, org };
}

async function listedLessons() {
  return listSitemapLibraryLessons(lastPage(await countSitemapLibraryLessons()));
}

async function listedChapters() {
  return listSitemapLibraryChapters(lastPage(await countSitemapLibraryChapters()));
}

describe(listSitemapLibraryChapters, () => {
  it("lists a chapter once, at its home course", async () => {
    const { chapter, course, org } = await homeChapter();
    const chapters = await listedChapters();
    const found = chapters.find((item) => item.chapterSlug === chapter.slug);

    expect(found).toStrictEqual({
      brandSlug: org.slug,
      chapterSlug: chapter.slug,
      courseSlug: course.slug,
      language: "pt",
      updatedAt: chapter.updatedAt,
    });
  });

  it("leaves out chapters whose home course isn't published", async () => {
    const { chapter } = await homeChapter({ isPublished: false });
    const chapters = await listedChapters();
    const found = chapters.find((item) => item.chapterSlug === chapter.slug);

    expect(found).toBeUndefined();
  });
});

describe(listSitemapLibraryLessons, () => {
  it("lists lessons at their home placement, including lessons not written yet", async () => {
    const { chapter, course, org } = await homeChapter();

    const lesson = await libraryLessonFixture({
      contentStatus: "pending",
      homeChapterId: chapter.id,
      language: "pt",
    });

    const lessons = await listedLessons();
    const found = lessons.find((item) => item.lessonSlug === lesson.slug);

    expect(found).toStrictEqual({
      brandSlug: org.slug,
      chapterSlug: chapter.slug,
      courseSlug: course.slug,
      language: "pt",
      lessonSlug: lesson.slug,
      updatedAt: lesson.updatedAt,
    });
  });

  it("never lists private lessons", async () => {
    const [{ chapter }, owner] = await Promise.all([homeChapter(), userFixture()]);

    const lesson = await libraryLessonFixture({
      homeChapterId: chapter.id,
      ownerId: owner.id,
      visibility: "private",
    });

    const lessons = await listedLessons();
    const found = lessons.find((item) => item.lessonSlug === lesson.slug);
    expect(found).toBeUndefined();
  });
});
