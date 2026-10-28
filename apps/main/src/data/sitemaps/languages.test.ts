import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { listSitemapCourses } from "./courses";
import { listSitemapLibraryChapters } from "./library-chapters";
import { listSitemapLibraryLessons } from "./library-lessons";
import { type SitemapResource, getSitemapPageIds } from "./sitemap-pages";

async function listSitemapPages<T>({
  list,
  resource,
}: {
  list: (page: number) => Promise<T[]>;
  resource: SitemapResource;
}): Promise<T[]> {
  const pages = getSitemapPageIds(resource);
  const rows = await Promise.all(pages.map((page) => list(page)));
  return rows.flat();
}

async function createLocalizedCatalog(language: string) {
  const organization = await organizationFixture({ kind: "brand" });

  const course = await courseFixture({
    isPublished: true,
    language,
    organizationId: organization.id,
  });

  const chapter = await libraryChapterFixture({ homeCourseId: course.id, language });
  const lesson = await libraryLessonFixture({ homeChapterId: chapter.id, language });

  return { chapter, course, lesson };
}

describe("sitemap content languages", () => {
  it("includes regional teaching languages and excludes unsupported or malformed languages throughout the catalog", async () => {
    const [regional, unsupported, malformed] = await Promise.all([
      createLocalizedCatalog("pt-BR"),
      createLocalizedCatalog("ja-JP"),
      createLocalizedCatalog("en_US"),
    ]);

    const [courses, chapters, lessons] = await Promise.all([
      listSitemapPages({ list: listSitemapCourses, resource: "courses" }),
      listSitemapPages({ list: listSitemapLibraryChapters, resource: "library-chapters" }),
      listSitemapPages({ list: listSitemapLibraryLessons, resource: "library-lessons" }),
    ]);

    const courseSlugs = courses.map((course) => course.courseSlug);
    const chapterSlugs = chapters.map((chapter) => chapter.chapterSlug);
    const lessonSlugs = lessons.map((lesson) => lesson.lessonSlug);

    expect(courseSlugs).toContain(regional.course.slug);
    expect(chapterSlugs).toContain(regional.chapter.slug);
    expect(lessonSlugs).toContain(regional.lesson.slug);

    for (const excluded of [unsupported, malformed]) {
      expect(courseSlugs).not.toContain(excluded.course.slug);
      expect(chapterSlugs).not.toContain(excluded.chapter.slug);
      expect(lessonSlugs).not.toContain(excluded.lesson.slug);
    }
  });
});
