import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { seedV2 } from "@zoonk/e2e/fixtures/seed-v2";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { resetGuestSpend } from "@zoonk/testing/fixtures/usage";
import { type CourseCategory } from "@zoonk/utils/categories";
import { normalizeString } from "@zoonk/utils/string";

const CATALOG_PAGINATION_COURSE_COUNT = 21;
const CATALOG_ORGANIZATION_SLUG = "e2e-catalog";

/**
 * The categories the generic catalog entries are filed under, so the catalog's prerendered row of
 * category chips holds more than fits a tablet's width and scrolls (`horizontal-scroll.test.ts`).
 * Law and technology stay empty: their tests open a category without courses.
 */
const CATALOG_PAGINATION_CATEGORIES = [
  "arts",
  "business",
  "communication",
  "culture",
  "engineering",
  "geography",
  "health",
  "history",
  "languages",
  "math",
] as const satisfies readonly CourseCategory[];

/**
 * Enough generic catalog entries for browser tests to exercise a second page without depending on
 * any course identity or ordering, filed under categories in turn. Written once per database under
 * stable slugs, so preparing the data again (before the build, then before the tests) adds
 * nothing, and a build restored from a cache links to courses that exist.
 */
async function createCatalogPaginationCourses() {
  const organization = await prisma.organization.upsert({
    create: { kind: "brand", name: "E2E Catalog", slug: CATALOG_ORGANIZATION_SLUG },
    update: {},
    where: { slug: CATALOG_ORGANIZATION_SLUG },
  });

  await Promise.all(
    Array.from({ length: CATALOG_PAGINATION_COURSE_COUNT }, async (_, index) => {
      const title = `E2E Catalog Course ${index + 1}`;
      const slug = `e2e-catalog-course-${index + 1}`;
      const category = CATALOG_PAGINATION_CATEGORIES[index % CATALOG_PAGINATION_CATEGORIES.length];

      const course = await prisma.course.upsert({
        create: {
          description: "Test course description",
          isPublished: true,
          language: "en",
          normalizedTitle: normalizeString(title),
          organizationId: organization.id,
          slug,
          title,
        },
        update: {},
        where: { orgSlug: { organizationId: organization.id, slug } },
      });

      if (category) {
        await prisma.courseCategory.upsert({
          create: { category, courseId: course.id },
          update: {},
          where: { courseCategory: { category, courseId: course.id } },
        });
      }
    }),
  );
}

/** The sitemaps' brand and Brazilian Portuguese content, under stable slugs (see `sitemap.test.ts`). */
export const SITEMAP_FIXTURES = {
  chapterSlug: "e2e-sitemap-chapter",
  courseSlug: "e2e-sitemap-course",
  lessonSlug: "e2e-sitemap-lesson",
  organizationSlug: "e2e-sitemap",
  undescribedChapterSlug: "e2e-sitemap-undescribed-chapter",
  undescribedCourseSlug: "e2e-sitemap-undescribed",
} as const;

const SITEMAP_LANGUAGE = "pt-BR";

/** A course of the sitemap brand, made once: published, with its page details unless `described` is false. */
async function upsertSitemapCourse({
  described,
  organizationId,
  slug,
}: {
  described: boolean;
  organizationId: string;
  slug: string;
}) {
  return prisma.course.upsert({
    create: {
      description: described ? "E2E sitemap course description" : null,
      isPublished: true,
      language: SITEMAP_LANGUAGE,
      normalizedTitle: normalizeString(slug),
      organizationId,
      slug,
      title: slug,
    },
    update: {},
    where: { orgSlug: { organizationId, slug } },
  });
}

/** A Library chapter made for `courseId` (its home), made once. */
async function upsertSitemapChapter({ courseId, slug }: { courseId: string; slug: string }) {
  const chapter = await prisma.chapter.findUnique({
    where: { homeCourseSlug: { homeCourseId: courseId, slug } },
  });

  return (
    chapter ?? libraryChapterFixture({ homeCourseId: courseId, language: SITEMAP_LANGUAGE, slug })
  );
}

/**
 * Sitemaps are prerendered from the database and kept for a day, so the content their test looks
 * for is written before the build: a listed Brazilian Portuguese course with its chapter and
 * lesson, and a course whose page details aren't written yet (a guest's goal made it), with its
 * chapter, which the sitemaps leave out.
 */
async function createSitemapContent() {
  const organization = await prisma.organization.upsert({
    create: { kind: "brand", name: "E2E Sitemap", slug: SITEMAP_FIXTURES.organizationSlug },
    update: {},
    where: { slug: SITEMAP_FIXTURES.organizationSlug },
  });

  const [course, undescribed] = await Promise.all([
    upsertSitemapCourse({
      described: true,
      organizationId: organization.id,
      slug: SITEMAP_FIXTURES.courseSlug,
    }),
    upsertSitemapCourse({
      described: false,
      organizationId: organization.id,
      slug: SITEMAP_FIXTURES.undescribedCourseSlug,
    }),
  ]);

  const [chapter] = await Promise.all([
    upsertSitemapChapter({ courseId: course.id, slug: SITEMAP_FIXTURES.chapterSlug }),
    upsertSitemapChapter({
      courseId: undescribed.id,
      slug: SITEMAP_FIXTURES.undescribedChapterSlug,
    }),
  ]);

  const lesson = await prisma.lesson.findUnique({
    where: { homeChapterSlug: { homeChapterId: chapter.id, slug: SITEMAP_FIXTURES.lessonSlug } },
  });

  if (!lesson) {
    await libraryLessonFixture({
      homeChapterId: chapter.id,
      language: SITEMAP_LANGUAGE,
      slug: SITEMAP_FIXTURES.lessonSlug,
    });
  }
}

/**
 * The structural data browser tests read: the v2 seed (the Library courses and one persona per
 * goal kind, `v2-*@zoonk.test`), the AI organization and the catalog's pages. It runs before the
 * E2E build, because the build prerenders the catalog from the database and serves that copy while
 * the tests run, and again before the tests, which also clears the AI budget guests share.
 */
export async function prepareE2EData(): Promise<void> {
  await seedV2();

  await Promise.all([
    getAiOrganization(),
    createCatalogPaginationCourses(),
    createSitemapContent(),
    resetGuestSpend(),
    prisma.liveCallSetting.upsert({
      create: { admission: "all", freeDailyBudgetMicros: 100_000_000, id: "live" },
      update: { admission: "all", freeDailyBudgetMicros: 100_000_000 },
      where: { id: "live" },
    }),
  ]);
}
