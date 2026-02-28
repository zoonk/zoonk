import "server-only";

/**
 * Resolves slug collision with an existing DB record.
 * Explicit slugs are always preserved. Auto-generated slugs
 * get a unique suffix when they collide with existing records.
 */
export function resolveImportSlug(params: {
  existingRecord: unknown;
  hasExplicitSlug: boolean;
  index: number;
  slug: string;
}): string {
  if (params.hasExplicitSlug || !params.existingRecord) {
    return params.slug;
  }

  return `${params.slug}-${Date.now()}-${params.index}`;
}

/**
 * Deduplicates slugs within an import batch to prevent
 * unique constraint violations when multiple items generate
 * the same slug.
 */
export function deduplicateImportSlugs<T extends { index: number; slug: string }>(items: T[]): T[] {
  const slugCounts = new Map<string, number>();

  return items.map((item) => {
    const count = slugCounts.get(item.slug) ?? 0;
    slugCounts.set(item.slug, count + 1);

    const slug = count > 0 ? `${item.slug}-${Date.now()}-${item.index}` : item.slug;

    return { ...item, slug };
  });
}
