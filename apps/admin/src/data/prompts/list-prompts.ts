import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma, sql } from "@zoonk/db";
import {
  type PromptOutcome,
  type PromptOutcomeRow,
  loadPrompts,
  promptOutcomesSql,
} from "./_utils/prompt-outcomes";

function promptSearchSql(search?: string) {
  if (!search) {
    return sql`TRUE`;
  }

  return sql`(
    strpos(lower(d.prompt), lower(${search}::text)) > 0
    OR strpos(lower(u.name), lower(${search}::text)) > 0
    OR strpos(lower(u.email), lower(${search}::text)) > 0
  )`;
}

const cachedListPrompts = cacheAdminData(
  async (limit: number, offset: number, outcome?: PromptOutcome, search?: string) => {
    const prompts = promptOutcomesSql(promptSearchSql(search));
    const outcomeFilter = outcome ? sql`outcome = ${outcome}` : sql`TRUE`;

    const [rows, [count]] = await Promise.all([
      prisma.$queryRaw<PromptOutcomeRow[]>`
        SELECT id, outcome, goal_ids
        FROM (${prompts}) prompts
        WHERE ${outcomeFilter}
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      prisma.$queryRaw<[{ total: bigint }]>`
        SELECT COUNT(*) AS total FROM (${prompts}) prompts WHERE ${outcomeFilter}
      `,
    ]);

    return { prompts: await loadPrompts(rows), total: Number(count.total) };
  },
);

export function listPrompts({
  limit,
  offset,
  outcome,
  search,
}: {
  limit: number;
  offset: number;
  outcome?: PromptOutcome;
  search?: string;
}) {
  return cachedListPrompts(limit, offset, outcome, search);
}

export type ListedPrompt = Awaited<ReturnType<typeof listPrompts>>["prompts"][number];
