import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { runHogQLQuery } from "./_utils/posthog-query";

export const AI_COST_PERIOD_DAYS = 30;

/** More task and model pairs than this would mean the task names stopped being a fixed set. */
const MAX_TASK_MODEL_ROWS = 500;

export type AiGenerationCostRow = {
  calls: number;
  model: string;
  p50LatencySeconds: number | null;
  p95LatencySeconds: number | null;
  personalCostUsd: number;
  task: string;
  totalCostUsd: number;
};

/**
 * `$ai_generation` events come from `toAiGenerationEvent` in `@zoonk/ai`: `task`, `$ai_model`,
 * `$ai_total_cost_usd`, `$ai_latency` in seconds and `content_scope` (shared or personal).
 */
const costByTaskAndModelQuery = `
  SELECT
    properties.task AS task,
    properties.$ai_model AS model,
    count() AS calls,
    sum(toFloat(properties.$ai_total_cost_usd)) AS total_cost_usd,
    sumIf(toFloat(properties.$ai_total_cost_usd), properties.content_scope = 'personal') AS personal_cost_usd,
    quantile(0.5)(toFloat(properties.$ai_latency)) AS p50_latency_seconds,
    quantile(0.95)(toFloat(properties.$ai_latency)) AS p95_latency_seconds
  FROM events
  WHERE event = '$ai_generation' AND timestamp >= now() - INTERVAL ${AI_COST_PERIOD_DAYS} DAY
  GROUP BY task, model
  ORDER BY total_cost_usd DESC
  LIMIT ${MAX_TASK_MODEL_ROWS}
`;

function toNullableNumber(value: unknown): number | null {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : null;
}

function toText(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

/** Rows are positional arrays, so each value is read by its column name. */
function toCostRow(columns: string[], row: unknown[]): AiGenerationCostRow {
  const read = (column: string) => row[columns.indexOf(column)];

  return {
    calls: toNullableNumber(read("calls")) ?? 0,
    model: toText(read("model"), "Unknown model"),
    p50LatencySeconds: toNullableNumber(read("p50_latency_seconds")),
    p95LatencySeconds: toNullableNumber(read("p95_latency_seconds")),
    personalCostUsd: toNullableNumber(read("personal_cost_usd")) ?? 0,
    task: toText(read("task"), "Unknown task"),
    totalCostUsd: toNullableNumber(read("total_cost_usd")) ?? 0,
  };
}

/** Calls, cost and latency per task and model over the last 30 days, from PostHog. */
export const getAiGenerationCosts = cacheAdminData(async () => {
  const result = await runHogQLQuery({
    name: "admin ai cost by task and model",
    query: costByTaskAndModelQuery,
  });

  if (result.status !== "ok") {
    return result;
  }

  return {
    rows: result.results.map((row) => toCostRow(result.columns, row)),
    status: "ok" as const,
  };
});
