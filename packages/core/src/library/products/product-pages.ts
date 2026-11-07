import "server-only";
import { type ProductWhereInput, prisma } from "@zoonk/db";

/** The official pages products read: their site, docs, releases page and each release's page. */
export async function listProductPageIds(where: ProductWhereInput): Promise<string[]> {
  const products = await prisma.product.findMany({
    select: {
      docsSourceId: true,
      releases: { select: { sourceId: true } },
      releasesSourceId: true,
      websiteSourceId: true,
    },
    where,
  });

  const ids = products.flatMap((product) => [
    product.websiteSourceId,
    product.docsSourceId,
    product.releasesSourceId,
    ...product.releases.map((release) => release.sourceId),
  ]);

  return [...new Set(ids.filter((id) => id !== null))];
}

/** The products that read a page, the same pages `listProductPageIds` lists. */
export function readsProductPage(sourceId: string): ProductWhereInput {
  return {
    OR: [
      { websiteSourceId: sourceId },
      { docsSourceId: sourceId },
      { releasesSourceId: sourceId },
      { releases: { some: { sourceId } } },
    ],
  };
}
