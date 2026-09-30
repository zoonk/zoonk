import { SITEMAP_BATCH_SIZE } from "./courses";

/**
 * Sitemap pages hold 5,000 URLs each. There's always at least one page, so
 * robots.txt can list it before the table has any rows.
 */
export function getSitemapPageIds(count: number): number[] {
  const pages = Math.max(Math.ceil(count / SITEMAP_BATCH_SIZE), 1);
  return Array.from({ length: pages }, (_, index) => index);
}
