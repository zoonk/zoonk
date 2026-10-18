import "server-only";
import { type Sql, prisma, sql } from "@zoonk/db";
import { type SearchTerm, parseSearchTerms, toTermTsQuery, toTsQuery } from "../text-search-query";

/** Enough candidates for the reuse decision to see near misses without paying for noise. */
export const MAX_IDENTITY_CANDIDATES = 5;

/**
 * How many matches of each search term are ranked. A term matching more rows is broad, and its
 * first matches stand in for the rest, so a search ranks a bounded number of rows however large
 * the Library grows, while a specific term still reaches every row it matches.
 */
export const MAX_MATCHES_PER_TERM = 100;

/** A search in one content language: an item matches when it holds every word of one term. */
export type TextSearch = { language: string; query: string; terms: readonly SearchTerm[] };

/**
 * A searchable document: a `text[]` of its parts and the content language that stems them. Built
 * from a row's own `language` and columns, it's the expression the table's text-search index is
 * built on (migration `library_text_search_index`), so Postgres reads the index instead of
 * computing a vector for every row.
 */
type SearchDocument = { language: Sql; parts: Sql };

/** The document of a table with a text-search index on it (see `search-documents.ts`). */
export type IndexedDocument = SearchDocument & {
  table: Sql;
  /** The alias the document's expressions use. */
  alias: Sql;
  /** A partial index's own conditions, which a scan repeats so it can read the index. */
  indexed?: Sql;
};

/** The search for these terms, or null when no term has a word. */
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

/** `library_search_vector` stems the document for its language, with and without accents. */
export function toSearchVector({ language, parts }: SearchDocument): Sql {
  return sql`library_search_vector(${language}, ${parts})`;
}

function toSearchQuery({ language, query }: { language: string; query: string }): Sql {
  return sql`to_tsquery(library_search_config(${language}), ${query})`;
}

/** The match condition and rank for one text search over a search vector. */
export function toVectorSearchSql({ search, vector }: { search: TextSearch; vector: Sql }) {
  const query = toSearchQuery(search);
  return { matches: sql`${vector} @@ ${query}`, rank: sql`ts_rank(${vector}, ${query})` };
}

/** The match condition and rank for one text search over one document. */
export function toTextSearchSql({
  document,
  search,
}: {
  document: SearchDocument;
  search: TextSearch;
}) {
  return toVectorSearchSql({ search, vector: toSearchVector(document) });
}

/**
 * The rows of a document's table that match a `tsquery` computed in the query, such as one term's,
 * read through its text-search index alone, under the table's alias. Postgres can't tell how few
 * rows a computed query matches, so it would also read a B-tree index on the request's filters
 * (every lesson in a language, on each term). `OFFSET 0` keeps those filters out of the scan: the
 * caller applies them to the index's matches, so a term costs about as much as its own matches.
 */
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

/**
 * Up to `MAX_MATCHES_PER_TERM` ids per `to_tsquery` expression, with how many the expression
 * found (`matches`), so a caller can leave out broad ones. `select` receives one expression's
 * `tsquery` and returns the ids of the rows it matches, filtered by the request, reading them with
 * `toIndexedMatchesSql` so the scan stops at the limit. An expression of stop words only matches
 * nothing instead of emptying the others.
 */
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

/** Each term's `to_tsquery` expression, in the order of the search's terms. */
export function toTermQueries(search: TextSearch): string[] {
  return search.terms.map((term) => toTermTsQuery(term));
}

/**
 * The best-ranked rows of one table for a search. Each term's matches are found through the
 * table's text-search index with the request's `filters` applied, then ranked together, so the
 * cost stays bounded when a term's words are common.
 */
export async function findRankedIds({
  document,
  filters,
  search,
}: {
  document: IndexedDocument;
  /** The request's conditions on the document's alias, such as its language and visibility. */
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

/** Restores the database's rank order after loading full rows by id. */
export function orderByIds<T extends { id: string }>(
  ids: readonly string[],
  rows: readonly T[],
): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}
