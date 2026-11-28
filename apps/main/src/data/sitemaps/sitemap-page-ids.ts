/** Fixed so a row's page never changes. Raising one moves rows between pages once, until search engines reread robots.txt. */
export const SITEMAP_PAGES = { courses: 1, "library-chapters": 8, "library-lessons": 32 } as const;

export type SitemapResource = keyof typeof SITEMAP_PAGES;

export function getSitemapPageIds(resource: SitemapResource): number[] {
  return Array.from({ length: SITEMAP_PAGES[resource] }, (_, index) => index);
}

export function isSitemapPage({ page, resource }: { page: number; resource: SitemapResource }) {
  return Number.isInteger(page) && page >= 0 && page < SITEMAP_PAGES[resource];
}
