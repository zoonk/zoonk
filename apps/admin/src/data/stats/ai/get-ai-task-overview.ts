import "server-only";
import { zoonkGateway } from "@zoonk/core/ai";
import { safeAsync } from "@zoonk/utils/error";
import {
  buildAiTaskTag,
  calculateAverageMarketCostPerRequest,
  calculateEstimatedMarketCost,
  extractAiDefaultModel,
  formatAiTaskLabel,
} from "./ai-task-stats";

type SpendReportTagRow = {
  marketCost?: number | null;
  requestCount?: number | null;
  tag?: string | null;
};

export type AiTaskOverview = {
  averageMarketCostPerRequest: number;
  defaultModels: string[];
  estimatedMarketCost: number;
  hasFallbackTracking: boolean;
  taskLabel: string;
  taskName: string;
  totalMarketCost: number;
  totalRequests: number;
};

/**
 * The task detail page now opens with a lightweight overview instead of the
 * full model table. A single grouped tag report is enough to show totals,
 * estimates, and which default-model tags were configured for that period.
 */
export async function getAiTaskOverview({
  endDate,
  runCount,
  startDate,
  taskName,
}: {
  endDate: string;
  runCount: number;
  startDate: string;
  taskName: string;
}): Promise<AiTaskOverview> {
  const taskTag = buildAiTaskTag(taskName);
  const { data, error } = await safeAsync(() =>
    zoonkGateway.getSpendReport({
      endDate,
      groupBy: "tag",
      startDate,
      tags: [taskTag],
    }),
  );

  if (error) {
    throw new Error(`Failed to load AI task overview for ${taskName}`, { cause: error });
  }

  const totals = getAiTaskTotals({ rows: data.results, taskTag });
  const averageMarketCostPerRequest = calculateAverageMarketCostPerRequest({
    marketCost: totals.totalMarketCost,
    requestCount: totals.totalRequests,
  });
  const defaultModels = getAiTaskDefaultModels(data.results);

  return {
    averageMarketCostPerRequest,
    defaultModels,
    estimatedMarketCost: calculateEstimatedMarketCost({
      averageMarketCostPerRequest,
      runCount,
    }),
    hasFallbackTracking: defaultModels.length > 0,
    taskLabel: formatAiTaskLabel(taskName),
    taskName,
    totalMarketCost: totals.totalMarketCost,
    totalRequests: totals.totalRequests,
  };
}

/**
 * The grouped tag response contains one row for the task tag itself plus any
 * default-model tags that were attached to those requests. Only the task-tag row
 * represents the total traffic for the task, so we isolate it here.
 */
function getAiTaskTotals({ rows, taskTag }: { rows: SpendReportTagRow[]; taskTag: string }) {
  const taskRow = rows.find((row) => row.tag === taskTag);

  return {
    totalMarketCost: taskRow?.marketCost ?? 0,
    totalRequests: taskRow?.requestCount ?? 0,
  };
}

/**
 * Default-model tags tell the admin which model configuration was active for
 * the task during the selected period, even when we have not loaded the full
 * per-model breakdown yet.
 */
function getAiTaskDefaultModels(rows: SpendReportTagRow[]) {
  return [
    ...new Set(rows.flatMap((row) => getAiTaskDefaultModelTags(row.tag ?? undefined))),
  ].toSorted();
}

/**
 * The reporting API returns raw tag strings. This helper keeps the flattening
 * logic readable while ignoring unrelated tag dimensions that may appear later.
 */
function getAiTaskDefaultModelTags(tag?: string) {
  const defaultModel = extractAiDefaultModel(tag);
  return defaultModel ? [defaultModel] : [];
}
