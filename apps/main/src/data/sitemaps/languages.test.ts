import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { countSitemapChapters, listSitemapChapters } from "./chapters";
import { SITEMAP_BATCH_SIZE, countSitemapCourses, listSitemapCourses } from "./courses";
import { countSitemapLessons, listSitemapLessons } from "./lessons";

/**
 * Read every sitemap page so excluded fixtures cannot appear to pass simply
 * because their IDs sort outside the final page in a shared test database.
 */
async function listSitemapPages<T>({
  count,
  list,
}: {
  count: () => Promise<number>;
  list: (page: number) => Promise<T[]>;
}): Promise<T[]> {
  const pages = Math.max(Math.ceil((await count()) / SITEMAP_BATCH_SIZE), 1);
  const rows = await Promise.all(Array.from({ length: pages }, (_, page) => list(page)));
  return rows.flat();
}

async function createLocalizedCatalog(language: string) {
  const organization = await organizationFixture({ kind: "brand" });

  const course = await courseFixture({
    isPublished: true,
    language,
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
      listSitemapPages({ count: countSitemapCourses, list: listSitemapCourses }),
      listSitemapPages({ count: countSitemapChapters, list: listSitemapChapters }),
      listSitemapPages({ count: countSitemapLessons, list: listSitemapLessons }),
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
