import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import { type Product, prisma } from "@zoonk/db";
import { listCoursesBehind } from "./course-release";
import { type ProductSourcesReading, readSourceVersions } from "./read-product-sources";
import { saveProductReleases } from "./save-product-research";

export type ReleasesReading = Pick<ProductSourcesReading, "provenance" | "releases"> & {
  contentHash: string;
  productId: string;
  sourceId: string;
};

/** The page's text with its hash, so every retry reads and records the same version. */
export type UnreadReleasesPage = {
  brand: string;
  contentHash: string;
  language: string;
  name: string;
  organizationId: string;
  productId: string;
  sourceId: string;
  text: string;
  title: string;
  url: string;
};

/** A page is read once its releases were saved from its hash or a reading of it failed for good. */
export function isReleasesPageUnread({
  contentHash,
  product,
}: {
  contentHash: string;
  product: Pick<Product, "releasesHash" | "unreadableReleasesHash">;
}): boolean {
  return contentHash !== product.releasesHash && contentHash !== product.unreadableReleasesHash;
}

/**
 * Internal workflow bridge for research's refresh of a stale product and the freshness check: a
 * known product's releases page when its text is unread, whether this run or an earlier one saved
 * it. Null when it's read already.
 */
export async function findUnreadReleasesPage(
  productId: string,
): Promise<UnreadReleasesPage | null> {
  const product = await prisma.product.findUnique({
    select: {
      name: true,
      organization: { select: { name: true } },
      organizationId: true,
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
      unreadableReleasesHash: true,
    },
    where: { id: productId },
  });

  const source = product?.releasesSource;

  if (
    !product ||
    !source?.extractedText ||
    !source.url ||
    !isReleasesPageUnread({ contentHash: source.contentHash, product })
  ) {
    return null;
  }

  return {
    brand: product.organization.name,
    contentHash: source.contentHash,
    language: source.language,
    name: product.name,
    organizationId: product.organizationId,
    productId,
    sourceId: source.id,
    text: source.extractedText,
    title: source.title,
    url: source.url,
  };
}

/** Internal workflow bridge: one model call over the page `findUnreadReleasesPage` found. */
export async function readReleasesPage({
  analytics,
  page,
  release,
  serviceTier,
}: {
  analytics?: AiGenerationContext;
  page: UnreadReleasesPage;
  /** A release the learner named, so the reading looks for it even past the newest ones. */
  release: string | null;
  serviceTier?: ServiceTier;
}): Promise<ReleasesReading> {
  const reading = await readSourceVersions({
    analytics,
    hints: { brand: page.brand, name: page.name, release },
    known: true,
    language: page.language,
    serviceTier,
    siblings: { NOT: { id: page.productId }, organizationId: page.organizationId },
    sources: [{ ...page, id: page.sourceId, isReleasesPage: true }],
  });

  return {
    contentHash: page.contentHash,
    productId: page.productId,
    provenance: reading.provenance,
    releases: reading.releases,
    sourceId: page.sourceId,
  };
}

/** Internal workflow bridge: a reading of the page failed after its retries in a way no retry fixes. */
export async function recordUnreadableReleasesPage({
  contentHash,
  productId,
}: Pick<UnreadReleasesPage, "contentHash" | "productId">): Promise<void> {
  await prisma.product.updateMany({
    data: { unreadableReleasesHash: contentHash },
    where: { id: productId },
  });
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
