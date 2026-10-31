import "server-only";
import { type MemoryCategory, prisma, sql } from "@zoonk/db";
import { toTextSearch, toTextSearchSql } from "../../library/identity/_utils/text-search-sql";

/**
 * Ranks without a text-search index: a Postgres index holds one language, and the learner's
 * `user_id` index already bounds the rows.
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
