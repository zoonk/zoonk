import { prisma, sql } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { SITEMAP_PAGES, type SitemapResource } from "./sitemap-page-ids";

/** Search engines read at most this many URLs from one sitemap. */
const SITEMAP_URL_LIMIT = 50_000;

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

const SITEMAP_TABLES = {
  "library-chapters": sql`library_chapters`,
  "library-lessons": sql`library_lessons`,
};

/** UUID suffixes keep membership stable while other rows join or leave independently cached pages. */
export async function getSitemapPageRowIds({
  page,
  resource,
}: {
  page: number;
  resource: keyof typeof SITEMAP_TABLES;
}): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(sql`
    SELECT id FROM ${SITEMAP_TABLES[resource]}
    WHERE visibility = 'public' AND ('x' || right(id::text, 8))::bit(32)::bigint % ${SITEMAP_PAGES[resource]} = ${page}
  `);

  return rows.map(({ id }) => id);
}
