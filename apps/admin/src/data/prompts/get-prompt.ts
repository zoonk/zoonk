import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma, sql } from "@zoonk/db";
import { type PromptOutcomeRow, loadPrompts, promptOutcomesSql } from "./_utils/prompt-outcomes";

export const getPrompt = cacheAdminData(async (id: string) => {
  const rows = await prisma.$queryRaw<PromptOutcomeRow[]>`
    SELECT id, outcome, goal_ids
    FROM (${promptOutcomesSql({ where: sql`d.id = ${id}::uuid` })}) prompts
  `;

  const [prompt] = await loadPrompts(rows);
  return prompt ?? null;
});

export type AdminPrompt = NonNullable<Awaited<ReturnType<typeof getPrompt>>>;
