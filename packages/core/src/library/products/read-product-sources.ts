import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import { readProductPages } from "@zoonk/ai/tasks/research/read-product-pages";
import { type ProductHints } from "@zoonk/ai/tasks/research/source-plan";
import { type ProductWhereInput, prisma } from "@zoonk/db";
import { toNameKey, whereProductNamed } from "./product-keys";
import { type CheckedProductReading, checkProductReading } from "./product-reading";

/** The name keys, names and aliases, of the products `where` finds. */
async function listProductKeys(where: ProductWhereInput): Promise<string[]> {
  const products = await prisma.product.findMany({
    select: { aliases: true, normalizedName: true },
    where,
  });

  return products.flatMap((product) => [product.normalizedName, ...product.aliases]);
}

type ReadSource = {
  contentHash: string;
  id: string;
  /** Research chose and verified it as the product's releases page, or its named release's page. */
  isReleasesPage: boolean;
  text: string;
  title: string;
  url: string;
};

async function loadReadSources({
  releasesPageIds,
  sourceIds,
}: {
  releasesPageIds: readonly string[];
  sourceIds: readonly string[];
}): Promise<ReadSource[]> {
  const rows = await prisma.source.findMany({
    select: { contentHash: true, extractedText: true, id: true, title: true, url: true },
    where: { id: { in: [...sourceIds] } },
  });

  return sourceIds.flatMap((id) => {
    const row = rows.find((source) => source.id === id);

    return row?.extractedText && row.url
      ? [
          {
            contentHash: row.contentHash,
            id,
            isReleasesPage: releasesPageIds.includes(id),
            text: row.extractedText,
            title: row.title,
            url: row.url,
          },
        ]
      : [];
  });
}

export type ProductSourcesReading = Omit<CheckedProductReading, "releases"> & {
  /** Each release with the source its passage was found in. */
  releases: (CheckedProductReading["releases"][number] & { sourceId: string })[];
  /** Each read source's hash, so a releases page's hash is the one its releases came from. */
  hashes: Record<string, string>;
  provenance: Awaited<ReturnType<typeof readProductPages>>["provenance"];
};

type ReadInput = {
  analytics?: AiGenerationContext;
  hints: ProductHints;
  /** The product is saved already, so only its releases are read. */
  known?: boolean;
  /** The pages' language, which names their months. */
  language: string;
  serviceTier?: ServiceTier;
};

/**
 * Internal workflow bridge for research: one model call over stored official pages, keeping only
 * the claims their pages state (`checkProductReading`).
 */
export async function readProductSources({
  brandDomain,
  releasesPageIds,
  sourceIds,
  ...input
}: ReadInput & {
  /** The brand's domain, whose other saved products' lines never give this one a release. */
  brandDomain: string;
  releasesPageIds: readonly string[];
  sourceIds: readonly string[];
}): Promise<ProductSourcesReading> {
  const sources = await loadReadSources({ releasesPageIds, sourceIds });

  return readSourceVersions({
    ...input,
    siblings: {
      NOT: whereProductNamed(toNameKey(input.hints.name)),
      organization: { domain: brandDomain },
    },
    sources,
  });
}

/** Internal workflow bridge for the freshness check: reads these versions of the pages. */
export async function readSourceVersions({
  analytics,
  hints,
  known = false,
  language,
  serviceTier,
  siblings,
  sources,
}: ReadInput & {
  /** The brand's other saved products, whose lines never give this one a release. */
  siblings: ProductWhereInput;
  sources: readonly ReadSource[];
}): Promise<ProductSourcesReading> {
  const [{ data, provenance }, siblingKeys] = await Promise.all([
    readProductPages({
      analytics,
      hints,
      known,
      pages: sources.map(({ text, title, url }) => ({ text, title, url })),
      serviceTier,
    }),
    listProductKeys(siblings),
  ]);

  const checked = checkProductReading({
    pages: sources.map(({ isReleasesPage, text }) => ({ isReleasesPage, language, text })),
    productName: hints.name,
    reading: data,
    siblingKeys,
  });

  return {
    ...checked,
    hashes: Object.fromEntries(sources.map((source) => [source.id, source.contentHash])),
    provenance,
    releases: checked.releases.flatMap((release) => {
      const source = sources[release.document - 1];
      return source ? [{ ...release, sourceId: source.id }] : [];
    }),
  };
}
