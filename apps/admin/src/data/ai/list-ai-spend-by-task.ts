import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { getAiSpendSince } from "./_utils/ai-spend-since";

type TaskSpendRow = {
  calls: bigint;
  cache_read_tokens: bigint;
  cost_usd: number | null;
  flex_calls: bigint;
  input_tokens: bigint;
  p50_latency_ms: number | null;
  personal_cost_usd: number | null;
  task: string;
};

/**
 * Spend per task, most expensive first: calls, cost (shared Library content against content made
 * for one learner), the share of input read from a prompt cache, how many calls ran at the flex
 * tier, and the median latency.
 */
export const listAiSpendByTask = cacheAdminData(async (days: number) => {
  const since = await getAiSpendSince(days);

  const rows = await prisma.$queryRaw<TaskSpendRow[]>`
    SELECT
      task,
      COUNT(*) AS calls,
      SUM(cost_usd) AS cost_usd,
      SUM(cost_usd) FILTER (WHERE content_scope = 'personal') AS personal_cost_usd,
      SUM(input_tokens) AS input_tokens,
      SUM(cache_read_tokens) AS cache_read_tokens,
      COUNT(*) FILTER (WHERE service_tier = 'flex') AS flex_calls,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency_ms
    FROM ai_calls
    WHERE created_at >= ${since}
    GROUP BY task
    ORDER BY SUM(cost_usd) DESC NULLS LAST
  `;

  return rows.map((row) => ({
    cacheReadTokens: Number(row.cache_read_tokens),
    calls: Number(row.calls),
    costUsd: row.cost_usd ?? 0,
    flexCalls: Number(row.flex_calls),
    inputTokens: Number(row.input_tokens),
    p50LatencyMs: row.p50_latency_ms,
    personalCostUsd: row.personal_cost_usd ?? 0,
    task: row.task,
  }));
});
