import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import { prisma } from "@zoonk/db";
import { listCoursesBehind } from "./course-release";
import { type ProductSourcesReading, readProductSources } from "./read-product-sources";
import { saveProductReleases } from "./save-product-research";

export type ReleasesReading = Pick<ProductSourcesReading, "provenance" | "releases"> & {
  contentHash: string;
  productId: string;
  sourceId: string;
};

async function findUnreadReleasesPage(productId: string) {
  const product = await prisma.product.findUnique({
    select: {
      name: true,
      organization: { select: { name: true } },
      releasesHash: true,
      releasesSource: {
        select: { contentHash: true, extractedText: true, id: true, language: true },
      },
    },
    where: { id: productId },
  });

  const source = product?.releasesSource;

  if (!product || !source?.extractedText || source.contentHash === product.releasesHash) {
    return null;
  }

  return { brand: product.organization.name, name: product.name, source };
}

/**
 * Internal workflow bridge for research's refresh of a stale product and the freshness check: reads
 * a known product's releases page when its text differs from the one its releases were read from,
 * whether this run or an earlier one saved it. Null when it's read already.
 */
export async function readProductReleases({
  analytics,
  productId,
  release,
  serviceTier,
}: {
  analytics?: AiGenerationContext;
  productId: string;
  /** A release the learner named, so the reading looks for it even past the newest ones. */
  release: string | null;
  serviceTier?: ServiceTier;
}): Promise<ReleasesReading | null> {
  const unread = await findUnreadReleasesPage(productId);

  if (!unread) {
    return null;
  }

  const { brand, name, source } = unread;

  const reading = await readProductSources({
    analytics,
    hints: { brand, name, release },
    known: true,
    language: source.language,
    serviceTier,
    sourceIds: [source.id],
  });

  return {
    contentHash: reading.hashes[source.id] ?? source.contentHash,
    productId,
    provenance: reading.provenance,
    releases: reading.releases,
    sourceId: source.id,
  };
}

/**
 * Internal workflow bridge. Saves the releases read from the page with the hash they were read
 * from, and returns the product's main courses now behind that a learner follows.
 */
export async function saveReadReleases({
  contentHash,
  productId,
  provenance,
  releases,
  sourceId,
}: ReleasesReading): Promise<string[]> {
  await saveProductReleases({
    productId,
    reading: { provenance, releases, releasesHash: contentHash, releasesSourceId: sourceId },
  });

  return listCoursesBehind({ productId });
}
