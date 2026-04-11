import {
  calculateAverageMarketCostPerRequest,
  calculateEstimatedMarketCost,
  formatAiTaskLabel,
} from "./ai-task-stats";
import { type AiTaskModelUsageRow, getAiTaskModelUsage } from "./get-ai-task-model-usage";

export type AiTaskModelReport = AiTaskModelUsageRow;

type AiTaskReport = {
  averageMarketCostPerRequest: number;
  defaultModels: string[];
  estimatedMarketCost: number;
  fallbackRequestCount: number;
  hasFallbackTracking: boolean;
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
  const usage = await getAiTaskModelUsage({ endDate, startDate, taskName });

  const averageMarketCostPerRequest = calculateAverageMarketCostPerRequest({
    marketCost: usage.totalMarketCost,
    requestCount: usage.totalRequests,
  });

  return {
    averageMarketCostPerRequest,
    defaultModels: usage.defaultModels,
    estimatedMarketCost: calculateEstimatedMarketCost({
      averageMarketCostPerRequest,
      runCount,
    }),
    fallbackRequestCount: usage.fallbackRequestCount,
    hasFallbackTracking: usage.hasFallbackTracking,
    models: usage.models,
    taskLabel: formatAiTaskLabel(taskName),
    taskName,
    totalMarketCost: usage.totalMarketCost,
    totalRequests: usage.totalRequests,
  };
}
