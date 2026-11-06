import "server-only";
import { prisma } from "@zoonk/db";
import { type LibraryProvenance } from "../_utils/library-rows";
import { listCoursesBehind } from "./course-release";
import { type CheckedProductRelease } from "./product-reading";
import { saveProductReleases } from "./save-product-research";

/**
 * Internal workflow bridge: a known product's releases page, when its text differs from the one its
 * releases were read from, whether this check or an earlier one saved it. Null when it's read already.
 */
export async function loadUnreadReleasesPage(productId: string) {
  const product = await prisma.product.findUnique({
    select: {
      name: true,
      organization: { select: { name: true } },
      releasesHash: true,
      releasesSource: {
        select: {
          contentHash: true,
          extractedText: true,
          id: true,
          language: true,
          title: true,
          url: true,
        },
      },
    },
    where: { id: productId },
  });

  const source = product?.releasesSource;

  if (!product || !source?.extractedText || source.contentHash === product.releasesHash) {
    return null;
  }

  return {
    contentHash: source.contentHash,
    hints: { brand: product.organization.name, name: product.name, release: null },
    page: {
      language: source.language,
      text: source.extractedText,
      title: source.title,
      url: source.url ?? "",
    },
    sourceId: source.id,
  };
}

/**
 * Internal workflow bridge. Saves the releases checked on the page with the hash they were read
 * from, and returns the product's main courses now behind that a learner follows.
 */
export async function saveCheckedReleases({
  contentHash,
  productId,
  provenance,
  releases,
  sourceId,
}: {
  contentHash: string;
  productId: string;
  provenance: LibraryProvenance;
  releases: readonly CheckedProductRelease[];
  sourceId: string;
}): Promise<string[]> {
  await saveProductReleases({
    productId,
    reading: {
      provenance,
      releases: releases.map((release) => ({
        name: release.name,
        releasedAt: release.releasedAt,
        sourceId,
        supportEndsAt: release.supportEndsAt,
        version: release.version,
      })),
      releasesHash: contentHash,
      releasesSourceId: sourceId,
    },
  });

  return listCoursesBehind({ productId });
}
