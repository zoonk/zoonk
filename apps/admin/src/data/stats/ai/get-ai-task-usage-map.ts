import "server-only";
import { zoonkGateway } from "@zoonk/core/ai";
import { safeAsync } from "@zoonk/utils/error";
import {
  type TaskUsageByName,
  calculateAverageMarketCostPerRequest,
  extractAiTaskName,
} from "./ai-task-stats";

type SpendReportTagRow = {
  marketCost?: number | null;
  requestCount?: number | null;
  tag?: string | null;
};

/**
 * The estimate views and the task index both need one normalized aggregate per task.
 * Loading the grouped tag report once here keeps the parsing rules in one place and
 * prevents every caller from re-implementing the same `task:*` filtering logic.
 */
export async function getAiTaskUsageMap({
  endDate,
  startDate,
}: {
  endDate: string;
  startDate: string;
}): Promise<TaskUsageByName> {
  const { data, error } = await safeAsync(() =>
    zoonkGateway.getSpendReport({
      endDate,
      groupBy: "tag",
      startDate,
    }),
  );

  if (error) {
    throw new Error("Failed to load AI task usage", { cause: error });
  }

  const usageByTask: TaskUsageByName = {};

  for (const row of data.results) {
    const taskName = extractAiTaskName((row satisfies SpendReportTagRow).tag ?? undefined);

    if (taskName) {
      const requestCount = row.requestCount ?? 0;
      const totalMarketCost = row.marketCost ?? 0;
      const current = usageByTask[taskName];
      const nextRequestCount = (current?.requestCount ?? 0) + requestCount;
      const nextTotalMarketCost = (current?.totalMarketCost ?? 0) + totalMarketCost;

      usageByTask[taskName] = {
        averageMarketCostPerRequest: calculateAverageMarketCostPerRequest({
          marketCost: nextTotalMarketCost,
          requestCount: nextRequestCount,
        }),
        requestCount: nextRequestCount,
        taskName,
        totalMarketCost: nextTotalMarketCost,
      };
    }
  }

  return usageByTask;
}
