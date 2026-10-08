import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { getAiSpendSince } from "./_utils/ai-spend-since";

const TOP_SPENDERS = 20;

type SpenderRow = { calls: bigint; cost_usd: number | null; id: string };

function toSpend(row: SpenderRow) {
  return { calls: Number(row.calls), costUsd: row.cost_usd ?? 0, id: row.id };
}

/**
 * The goals and learners whose AI calls cost the most in the period, shared Library content they
 * caused included, so a runaway goal or account stands out.
 */
export const listTopAiSpenders = cacheAdminData(async (days: number) => {
  const since = await getAiSpendSince(days);

  const [goalRows, learnerRows] = await Promise.all([
    prisma.$queryRaw<SpenderRow[]>`
      SELECT goal_id AS id, COUNT(*) AS calls, SUM(cost_usd) AS cost_usd
      FROM ai_calls
      WHERE created_at >= ${since} AND goal_id IS NOT NULL
      GROUP BY goal_id
      ORDER BY SUM(cost_usd) DESC NULLS LAST
      LIMIT ${TOP_SPENDERS}
    `,
    prisma.$queryRaw<SpenderRow[]>`
      SELECT user_id AS id, COUNT(*) AS calls, SUM(cost_usd) AS cost_usd
      FROM ai_calls
      WHERE created_at >= ${since} AND user_id IS NOT NULL
      GROUP BY user_id
      ORDER BY SUM(cost_usd) DESC NULLS LAST
      LIMIT ${TOP_SPENDERS}
    `,
  ]);

  const [goals, users] = await Promise.all([
    prisma.goal.findMany({
      select: { id: true, kind: true, title: true, user: { select: { email: true, id: true } } },
      where: { id: { in: goalRows.map((row) => row.id) } },
    }),
    prisma.user.findMany({
      select: { email: true, id: true, isAnonymous: true, name: true },
      where: { id: { in: learnerRows.map((row) => row.id) } },
    }),
  ]);

  const goalsById = new Map(goals.map((goal) => [goal.id, goal]));
  const usersById = new Map(users.map((user) => [user.id, user]));

  return {
    goals: goalRows.map((row) => ({ ...toSpend(row), goal: goalsById.get(row.id) ?? null })),
    learners: learnerRows.map((row) => ({ ...toSpend(row), user: usersById.get(row.id) ?? null })),
  };
});
