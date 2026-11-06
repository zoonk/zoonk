import "server-only";
import { type Course, prisma } from "@zoonk/db";
import { lockCourseHome } from "@zoonk/db/course-home";
import { normalizeString } from "@zoonk/utils/string";
import { getAvailableCourseSlug } from "../_utils/available-course-slug";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { pickCurrentRelease } from "./current-release";

function loadProduct(productId: string) {
  return prisma.product.findUniqueOrThrow({
    include: { releases: { select: { id: true, name: true, releasedAt: true } } },
    where: { id: productId },
  });
}

type CourseProduct = Awaited<ReturnType<typeof loadProduct>>;

function toCourseKind({
  now,
  pinnedReleaseId,
  product,
}: {
  now: Date;
  pinnedReleaseId: string | null;
  product: CourseProduct;
}) {
  if (!pinnedReleaseId) {
    const current = pickCurrentRelease({ now, releases: product.releases });
    return { key: { isPinned: false }, releaseId: current?.id ?? null, title: product.name };
  }

  const pinned = product.releases.find((release) => release.id === pinnedReleaseId);

  if (!pinned) {
    throw new Error(`Release ${pinnedReleaseId} isn't a release of product ${product.id}`);
  }

  return {
    key: { isPinned: true, productReleaseId: pinned.id },
    releaseId: pinned.id,
    title: pinned.name,
  };
}

/**
 * Internal workflow bridge. A product's courses live in its brand's organization: one main course
 * per language, titled with the product's name and created teaching its current release, and, for
 * a release a learner named (`pinnedReleaseId`), one pinned course per language titled with that
 * release's name. They are found by those keys, never by an identity judge; the main course is found
 * whatever release it teaches now.
 */
export async function findOrCreateProductCourse({
  language,
  now = new Date(),
  pinnedReleaseId,
  productId,
  provenance,
}: {
  language: string;
  now?: Date;
  pinnedReleaseId: string | null;
  productId: string;
  provenance: LibraryProvenance;
}): Promise<{ course: Course; created: boolean }> {
  const product = await loadProduct(productId);
  const { organizationId } = product;
  const { key, releaseId, title } = toCourseKind({ now, pinnedReleaseId, product });

  return prisma.$transaction(async (tx) => {
    await lockCourseHome({ homeId: organizationId, transaction: tx });

    const existing = await tx.course.findFirst({
      orderBy: { createdAt: "asc" },
      where: { ...key, language, organizationId, productId, userId: null },
    });

    if (existing) {
      return { course: existing, created: false };
    }

    const course = await tx.course.create({
      data: {
        ...toProvenanceData(provenance),
        format: "core",
        isPinned: key.isPinned,
        isPublished: false,
        language,
        normalizedTitle: normalizeString(title),
        organizationId,
        outlineStatus: "pending",
        productId,
        productReleaseId: releaseId,
        slug: await getAvailableCourseSlug(tx, { home: { organizationId }, language, title }),
        title,
        visibility: "public",
      },
    });

    return { course, created: true };
  });
}
