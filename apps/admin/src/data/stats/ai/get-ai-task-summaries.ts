import "server-only";
import { formatAiTaskLabel } from "./ai-task-stats";
import { getAiTaskUsageMap } from "./get-ai-task-usage-map";

export type AiTaskSummary = {
  averageMarketCostPerRequest: number;
  requestCount: number;
  taskLabel: string;
  taskName: string;
  totalMarketCost: number;
};

/**
 * The index summary should be one billed reporting query, not one query plus a
 * follow-up for every task. This loader reuses the shared task-usage map and
 * only formats the active tasks for the selected date range.
 */
export async function getAiTaskSummaries({
  endDate,
  startDate,
}: {
  endDate: string;
  startDate: string;
}): Promise<AiTaskSummary[]> {
  const usageByTask = await getAiTaskUsageMap({ endDate, startDate });

  return Object.values(usageByTask)
    .map((task) => ({
      averageMarketCostPerRequest: task.averageMarketCostPerRequest,
      requestCount: task.requestCount,
      taskLabel: formatAiTaskLabel(task.taskName),
      taskName: task.taskName,
      totalMarketCost: task.totalMarketCost,
    }))
    .toSorted(compareAiTaskSummaries);
}

/**
 * Request volume is the fastest way to see which tasks mattered most in the
 * selected period, so the summary stays sorted by traffic before falling back
 * to a stable alphabetical label order.
 */
function compareAiTaskSummaries(left: AiTaskSummary, right: AiTaskSummary) {
  if (right.requestCount !== left.requestCount) {
    return right.requestCount - left.requestCount;
  }

  return left.taskLabel.localeCompare(right.taskLabel);
}
