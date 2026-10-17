import "server-only";
import { type MemoryCategory, prisma, sql } from "@zoonk/db";
import { toTextSearch, toTextSearchSql } from "../../library/identity/_utils/text-search-sql";

/**
 * Finds the ids of a learner's current facts whose statement contains every word of at least one
 * term, best matches first, with the same stemmed, accent-insensitive search the Library uses.
 *
 * Unlike the Library's searches (`findRankedIds`), it ranks every match without a text-search
 * index: the learner's own facts, read through their `user_id` index, bound the work. An index
 * would span every learner, so a common word would read every learner's matches, and it can't
 * hold the caller's language.
 */
export async function searchMemoryFactIds({
  categories,
  includeSensitive = true,
  language,
  limit,
  now,
  terms,
  userId,
}: {
  categories: readonly MemoryCategory[];
  includeSensitive?: boolean;
  language: string;
  limit: number;
  now: Date;
  terms: readonly string[];
  userId: string;
}): Promise<string[]> {
  const search = toTextSearch({ language, terms });

  if (!search || categories.length === 0) {
    return [];
  }

  const { matches, rank } = toTextSearchSql({
    document: { language: sql`${language}`, parts: sql`ARRAY[m.statement]` },
    search,
  });

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT m.id FROM memory_facts m
    WHERE m.user_id = ${userId}::uuid
      AND m.status = 'active'
      AND (m.expires_at IS NULL OR m.expires_at > ${now})
      AND m.category::text = ANY(${[...categories]}::text[])
      AND (${includeSensitive}::boolean OR NOT m.sensitive)
      AND ${matches}
    ORDER BY ${rank} DESC, m.created_at DESC
    LIMIT ${limit}`;

  return rows.map((row) => row.id);
}
