import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import { readProductPages } from "@zoonk/ai/tasks/research/read-product-pages";
import { type ProductHints } from "@zoonk/ai/tasks/research/source-plan";
import { prisma } from "@zoonk/db";
import { type CheckedProductReading, checkProductReading } from "./product-reading";

type ReadSource = { contentHash: string; id: string; text: string; title: string; url: string };

async function loadReadSources(sourceIds: readonly string[]): Promise<ReadSource[]> {
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

/**
 * Internal workflow bridge for research and the freshness check: one model call over stored
 * official pages, keeping only the claims their pages state (`checkProductReading`).
 */
export async function readProductSources({
  analytics,
  hints,
  known = false,
  language,
  serviceTier,
  sourceIds,
}: {
  analytics?: AiGenerationContext;
  hints: ProductHints;
  /** The product is saved already, so only its releases are read. */
  known?: boolean;
  /** The pages' language, which names their months. */
  language: string;
  serviceTier?: ServiceTier;
  sourceIds: readonly string[];
}): Promise<ProductSourcesReading> {
  const sources = await loadReadSources(sourceIds);

  const { data, provenance } = await readProductPages({
    analytics,
    hints,
    known,
    pages: sources.map(({ text, title, url }) => ({ text, title, url })),
    serviceTier,
  });

  const checked = checkProductReading({
    pages: sources.map((source) => ({ language, text: source.text })),
    reading: data,
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
