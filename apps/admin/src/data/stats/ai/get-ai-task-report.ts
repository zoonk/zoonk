import "server-only";
import { zoonkGateway } from "@zoonk/core/ai";
import { safeAsync } from "@zoonk/utils/error";
import {
  buildAiTaskTag,
  calculateAverageMarketCostPerRequest,
  calculateEstimatedMarketCost,
  formatAiTaskLabel,
} from "./ai-task-stats";

export type AiTaskModelReport = {
  averageMarketCostPerRequest: number;
  marketCost: number;
  model: string;
  requestCount: number;
  totalCost: number;
};

type AiTaskReport = {
  averageMarketCostPerRequest: number;
  estimatedMarketCost: number;
  models: AiTaskModelReport[];
  taskLabel: string;
  taskName: string;
  totalMarketCost: number;
  totalRequests: number;
};

/**
 * The task detail page needs one report row per model plus an overall task
 * summary. Gateway reporting already aggregates by model, so this function only
 * normalizes missing values, derives averages, and computes the overall estimate.
 */
export async function getAiTaskReport({
  endDate,
  runCount,
  startDate,
  taskName,
}: {
  endDate: string;
  runCount: number;
  startDate: string;
  taskName: string;
}): Promise<AiTaskReport> {
  const { data, error } = await safeAsync(() =>
    zoonkGateway.getSpendReport({
      endDate,
      groupBy: "model",
      startDate,
      tags: [buildAiTaskTag(taskName)],
    }),
  );

  if (error) {
    throw new Error(`Failed to load AI stats for ${taskName}`, { cause: error });
  }

  const models = data.results
    .flatMap((row) => {
      if (!row.model) {
        return [];
      }

      const requestCount = row.requestCount ?? 0;
      const marketCost = row.marketCost ?? 0;

      return [
        {
          averageMarketCostPerRequest: calculateAverageMarketCostPerRequest({
            marketCost,
            requestCount,
          }),
          marketCost,
          model: row.model,
          requestCount,
          totalCost: row.totalCost,
        } satisfies AiTaskModelReport,
      ];
    })
    .toSorted((left, right) => {
      if (right.requestCount !== left.requestCount) {
        return right.requestCount - left.requestCount;
      }

      return left.model.localeCompare(right.model);
    });

  const totals = models.reduce(
    (currentTotals, model) => ({
      totalMarketCost: currentTotals.totalMarketCost + model.marketCost,
      totalRequests: currentTotals.totalRequests + model.requestCount,
    }),
    { totalMarketCost: 0, totalRequests: 0 },
  );

  const averageMarketCostPerRequest = calculateAverageMarketCostPerRequest({
    marketCost: totals.totalMarketCost,
    requestCount: totals.totalRequests,
  });

  return {
    averageMarketCostPerRequest,
    estimatedMarketCost: calculateEstimatedMarketCost({
      averageMarketCostPerRequest,
      runCount,
    }),
    models,
    taskLabel: formatAiTaskLabel(taskName),
    taskName,
    totalMarketCost: totals.totalMarketCost,
    totalRequests: totals.totalRequests,
  };
}
