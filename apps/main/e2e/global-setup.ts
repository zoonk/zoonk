import { prisma } from "@zoonk/db";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { normalizeString } from "@zoonk/utils/string";

const CATALOG_PAGINATION_COURSE_COUNT = 21;

/**
 * Creates enough generic catalog entries for browser tests to exercise a
 * second page without depending on any course identity or ordering.
 */
async function createCatalogPaginationCourses() {
  const organization = await createOrganization({ name: "E2E Catalog" });

  await Promise.all(
    Array.from({ length: CATALOG_PAGINATION_COURSE_COUNT }, (_, index) => {
      const title = `E2E Catalog Course ${index + 1}`;

      return courseFixture({
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(title),
        organizationId: organization.id,
        title,
      });
    }),
  );
}

/**
 * Prepares structural data before any browser request can populate the app's
 * persistent catalog cache.
 */
export default async function globalSetup(): Promise<void> {
  await Promise.all([getAiOrganization(), createCatalogPaginationCourses()]);
  await prisma.$disconnect();
}
