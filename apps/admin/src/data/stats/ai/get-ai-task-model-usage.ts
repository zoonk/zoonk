import "server-only";
import { zoonkGateway } from "@zoonk/core/ai";
import { safeAsync } from "@zoonk/utils/error";
import {
  buildAiTaskTag,
  calculateAverageMarketCostPerRequest,
  extractAiDefaultModel,
  isFallbackModel,
} from "./ai-task-stats";

export type AiTaskModelUsageRow = {
  averageMarketCostPerRequest: number;
  isFallback: boolean;
  marketCost: number;
  model: string;
  requestCount: number;
  totalCost: number;
};

type AiTaskModelUsage = {
  defaultModels: string[];
  fallbackRequestCount: number;
  hasFallbackTracking: boolean;
  models: AiTaskModelUsageRow[];
  totalMarketCost: number;
  totalRequests: number;
};

/**
 * The AI stats pages need the same normalized Gateway data in two places:
 * the task list needs fallback counts per task, and the task detail page needs
 * per-model rows plus fallback markers. This helper fetches and normalizes that
 * shared reporting data once per task.
 */
export async function getAiTaskModelUsage({
  endDate,
  startDate,
  taskName,
}: {
  endDate: string;
  startDate: string;
  taskName: string;
}): Promise<AiTaskModelUsage> {
  const taskTag = buildAiTaskTag(taskName);
  const [modelResponse, tagResponse] = await Promise.all([
    safeAsync(() =>
      zoonkGateway.getSpendReport({
        endDate,
        groupBy: "model",
        startDate,
        tags: [taskTag],
      }),
    ),
    safeAsync(() =>
      zoonkGateway.getSpendReport({
        endDate,
        groupBy: "tag",
        startDate,
        tags: [taskTag],
      }),
    ),
  ]);

  if (modelResponse.error) {
    throw new Error(`Failed to load AI model usage for ${taskName}`, {
      cause: modelResponse.error,
    });
  }

  if (tagResponse.error) {
    throw new Error(`Failed to load AI model metadata for ${taskName}`, {
      cause: tagResponse.error,
    });
  }

  const defaultModels = [
    ...new Set(
      tagResponse.data.results.flatMap((row) => {
        const defaultModel = extractAiDefaultModel(row.tag);
        return defaultModel ? [defaultModel] : [];
      }),
    ),
  ].toSorted();

  const models = modelResponse.data.results
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
          isFallback: isFallbackModel({ defaultModels, model: row.model }),
          marketCost,
          model: row.model,
          requestCount,
          totalCost: row.totalCost,
        } satisfies AiTaskModelUsageRow,
      ];
    })
    .toSorted((left, right) => {
      if (right.requestCount !== left.requestCount) {
        return right.requestCount - left.requestCount;
      }

      return left.model.localeCompare(right.model);
    });

  return buildAiTaskModelUsage({ defaultModels, models });
}

/**
 * The reporting API gives us row-level aggregates, but the admin views want
 * totals, fallback counts, and a flag that tells us whether default-model tags
 * are available for the selected time range.
 */
function buildAiTaskModelUsage({
  defaultModels,
  models,
}: {
  defaultModels: string[];
  models: AiTaskModelUsageRow[];
}): AiTaskModelUsage {
  const totals = models.reduce(
    (currentTotals, model) => ({
      fallbackRequestCount:
        currentTotals.fallbackRequestCount + (model.isFallback ? model.requestCount : 0),
      totalMarketCost: currentTotals.totalMarketCost + model.marketCost,
      totalRequests: currentTotals.totalRequests + model.requestCount,
    }),
    {
      fallbackRequestCount: 0,
      totalMarketCost: 0,
      totalRequests: 0,
    },
  );

  return {
    defaultModels,
    fallbackRequestCount: totals.fallbackRequestCount,
    hasFallbackTracking: defaultModels.length > 0,
    models,
    totalMarketCost: totals.totalMarketCost,
    totalRequests: totals.totalRequests,
  };
}
