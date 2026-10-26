import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { seedV2 } from "@zoonk/e2e/fixtures/seed-v2";
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
    resetGuestSpend(),
    prisma.liveCallSetting.upsert({
      create: { admission: "all", freeDailyBudgetMicros: 100_000_000, id: "live" },
      update: { admission: "all", freeDailyBudgetMicros: 100_000_000 },
      where: { id: "live" },
    }),
  ]);
}
