import { prisma } from "@zoonk/db";
import { seedV2 } from "@zoonk/db/seed/v2";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { resetNewcomerSpend } from "@zoonk/testing/fixtures/usage";
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
 * persistent catalog cache, and clears the AI budget newcomers share, which every run's young
 * test accounts would otherwise spend. The v2 seed adds the Library courses and one persona
 * per goal kind (`v2-*@zoonk.test`, the seed password) that learning flows sign in as.
 */
export default async function globalSetup(): Promise<void> {
  await seedV2(prisma);
  await Promise.all([getAiOrganization(), createCatalogPaginationCourses(), resetNewcomerSpend()]);
  await prisma.$disconnect();
}
