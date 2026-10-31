import { logError } from "@zoonk/utils/logger";

/** Search engines read at most this many URLs from one sitemap. */
const SITEMAP_URL_LIMIT = 50_000;

/** Fixed so a row's page never changes. Raising one moves rows between pages once, until search engines reread robots.txt. */
const SITEMAP_PAGES = { courses: 1, "library-chapters": 8, "library-lessons": 32 } as const;

export type SitemapResource = keyof typeof SITEMAP_PAGES;

export function warnIfSitemapPageIsFull({
  page,
  resource,
  rows,
}: {
  page: number;
  resource: SitemapResource;
  rows: number;
}) {
  if (rows > SITEMAP_URL_LIMIT) {
    logError("A sitemap page holds more URLs than search engines read", { page, resource, rows });
  }
}

export function getSitemapPageIds(resource: SitemapResource): number[] {
  return Array.from({ length: SITEMAP_PAGES[resource] }, (_, index) => index);
}

export function isSitemapPage({ page, resource }: { page: number; resource: SitemapResource }) {
  return Number.isInteger(page) && page >= 0 && page < SITEMAP_PAGES[resource];
}

/** The id's last 8 hex digits (32 bits), random in every id version the tables hold (v4, v7, v8). */
const ID_RANDOM_HEX_DIGITS = 8;

/**
 * From the id alone: search engines read each page at a different time and every page is cached on
 * its own, so a row joining or leaving must not move others between pages.
 */
function getSitemapPage({ id, resource }: { id: string; resource: SitemapResource }) {
  return Number.parseInt(id.slice(-ID_RANDOM_HEX_DIGITS), 16) % SITEMAP_PAGES[resource];
}

export function getSitemapPageRowIds({
  listed,
  page,
  resource,
}: {
  listed: readonly { id: string }[];
  page: number;
  resource: SitemapResource;
}): string[] {
  return listed.flatMap(({ id }) => (getSitemapPage({ id, resource }) === page ? [id] : []));
}
