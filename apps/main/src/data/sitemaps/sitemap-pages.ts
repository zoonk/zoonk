import { logError } from "@zoonk/utils/logger";

/** Search engines read at most this many URLs from one sitemap. */
const SITEMAP_URL_LIMIT = 50_000;

/**
 * Each sitemap's number of pages, fixed so a row's page never changes (see `getSitemapPage`): it
 * holds up to pages × `SITEMAP_URL_LIMIT` URLs, far past today's catalog (dozens of courses,
 * thousands of chapters, tens of thousands of lessons). Raising one moves rows between pages once,
 * until search engines read robots.txt again.
 */
const SITEMAP_PAGES = { courses: 1, "library-chapters": 8, "library-lessons": 32 } as const;

export type SitemapResource = keyof typeof SITEMAP_PAGES;

/**
 * Says so when a page holds more URLs than search engines read from one sitemap: the catalog
 * outgrew its pages (`SITEMAP_PAGES`), and the URLs past the limit go unread.
 */
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

/** A sitemap's pages, numbered from 0. */
export function getSitemapPageIds(resource: SitemapResource): number[] {
  return Array.from({ length: SITEMAP_PAGES[resource] }, (_, index) => index);
}

/** Whether `page` is one of the sitemap's pages; other numbers are no page. */
export function isSitemapPage({ page, resource }: { page: number; resource: SitemapResource }) {
  return Number.isInteger(page) && page >= 0 && page < SITEMAP_PAGES[resource];
}

/** The id's last 8 hex digits (32 bits), random in every id version the tables hold (v4, v7, v8). */
const ID_RANDOM_HEX_DIGITS = 8;

/**
 * The page a row is listed on, from its id alone (its random last 32 bits). Search engines read
 * each page at a different time and every page is cached on its own, so a row's page can't depend
 * on other rows or on how many there are: then a row joining or leaving the listing would move
 * others between pages read at different times, out of every one.
 */
function getSitemapPage({ id, resource }: { id: string; resource: SitemapResource }) {
  return Number.parseInt(id.slice(-ID_RANDOM_HEX_DIGITS), 16) % SITEMAP_PAGES[resource];
}

/** The ids of `listed` that `page` holds. */
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
