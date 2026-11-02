import "server-only";
import { type Sql, prisma, sql } from "@zoonk/db";
import { type SearchTerm, parseSearchTerms, toTermTsQuery, toTsQuery } from "../text-search-query";

export const MAX_IDENTITY_CANDIDATES = 5;

export const MAX_MATCHES_PER_TERM = 100;

export type TextSearch = { language: string; query: string; terms: readonly SearchTerm[] };

type SearchDocument = { language: Sql; parts: Sql };

export type IndexedDocument = SearchDocument & { table: Sql; alias: Sql; indexed?: Sql };

export function toTextSearch({
  language,
  terms,
}: {
  language: string;
  terms: readonly string[];
}): TextSearch | null {
  const parsed = parseSearchTerms(terms);
  const query = toTsQuery(parsed);

  return query ? { language, query, terms: parsed } : null;
}

export function toSearchVector({ language, parts }: SearchDocument): Sql {
  return sql`library_search_vector(${language}, ${parts})`;
}

function toSearchQuery({ language, query }: { language: string; query: string }): Sql {
  return sql`to_tsquery(library_search_config(${language}), ${query})`;
}

export function toVectorSearchSql({ search, vector }: { search: TextSearch; vector: Sql }) {
  const query = toSearchQuery(search);
  return { matches: sql`${vector} @@ ${query}`, rank: sql`ts_rank(${vector}, ${query})` };
}

export function toTextSearchSql({
  document,
  search,
}: {
  document: SearchDocument;
  search: TextSearch;
}) {
  return toVectorSearchSql({ search, vector: toSearchVector(document) });
}

/** `OFFSET 0` prevents PostgreSQL from pushing broad request filters into the text-index scan. */
export function toIndexedMatchesSql({
  document,
  query,
}: {
  document: IndexedDocument;
  query: Sql;
}): Sql {
  const match = sql`${toSearchVector(document)} @@ ${query}`;
  const conditions = document.indexed ? sql`${document.indexed} AND ${match}` : match;

  return sql`(
    SELECT * FROM ${document.table} ${document.alias} WHERE ${conditions} OFFSET 0
  ) ${document.alias}`;
}

export function toTermMatchesSql({
  language,
  queries,
  select,
}: {
  language: string;
  queries: readonly string[];
  select: (query: Sql) => Sql;
}): Sql {
  return sql`
    SELECT matched.id, matched.matches
    FROM (
      SELECT to_tsquery(library_search_config(${language}), term) AS query
      FROM unnest(${queries}::text[]) AS term
    ) terms
    CROSS JOIN LATERAL (
      SELECT found.id, count(*) OVER () AS matches
      FROM (${select(sql`terms.query`)} LIMIT ${MAX_MATCHES_PER_TERM}) found
    ) matched`;
}

export function toTermQueries(search: TextSearch): string[] {
  return search.terms.map((term) => toTermTsQuery(term));
}

export async function findRankedIds({
  document,
  filters,
  search,
}: {
  document: IndexedDocument;
  filters: Sql;
  search: TextSearch;
}): Promise<string[]> {
  const { alias, table } = document;

  const matches = toTermMatchesSql({
    language: search.language,
    queries: toTermQueries(search),
    select: (query) =>
      sql`SELECT ${alias}.id FROM ${toIndexedMatchesSql({ document, query })} WHERE ${filters}`,
  });

  const { rank } = toTextSearchSql({ document, search });

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT ${alias}.id FROM ${table} ${alias}
    WHERE ${alias}.id IN (SELECT id FROM (${matches}) term_matches)
    ORDER BY ${rank} DESC, ${alias}.id
    LIMIT ${MAX_IDENTITY_CANDIDATES}`;

  return rows.map((row) => row.id);
}

/** Restores `ids` order after a database load; database result order is not assumed. */
export function orderByIds<T extends { id: string }>(
  ids: readonly string[],
  rows: readonly T[],
): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}
