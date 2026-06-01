export type CatalogGridItemKey = string | number | bigint;

type CatalogActiveItem = { id: CatalogGridItemKey; slug: string };

/**
 * Catalog tiles need stable DOM anchors so both floating and toolbar shortcuts
 * can jump to the same chapter or lesson without coupling scroll behavior to
 * route URLs.
 */
export function getCatalogItemTargetId(itemKey: CatalogGridItemKey): string {
  return `catalog-item-${String(itemKey)}`;
}

/**
 * Active catalog targets are resolved by slug because progress logic lives
 * outside the rendered grid; converting that slug back to the tile id keeps the
 * DOM anchor source of truth in the visible item collection.
 */
export function getCatalogActiveItemKey({
  activeSlug,
  items,
}: {
  activeSlug?: string | null;
  items: readonly CatalogActiveItem[];
}): CatalogGridItemKey | null {
  return items.find((item) => item.slug === activeSlug)?.id ?? null;
}
