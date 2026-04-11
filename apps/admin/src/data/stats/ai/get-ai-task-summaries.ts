import "server-only";
import { zoonkGateway } from "@zoonk/core/ai";
import { safeAsync } from "@zoonk/utils/error";
import { extractAiTaskName, formatAiTaskLabel } from "./ai-task-stats";

export type AiTaskSummary = {
  requestCount: number;
  taskLabel: string;
  taskName: string;
};

/**
 * The stats index groups spend-report rows by tag so admins can see which AI
 * tasks ran most often in the last 30 days. We filter the response down to our
 * `task:*` tags and sort by request volume so the busiest tasks appear first.
 */
export async function getAiTaskSummaries({
  endDate,
  startDate,
}: {
  endDate: string;
  startDate: string;
}): Promise<AiTaskSummary[]> {
  const { data, error } = await safeAsync(() =>
    zoonkGateway.getSpendReport({
      endDate,
      groupBy: "tag",
      startDate,
    }),
  );

  if (error) {
    throw new Error("Failed to load AI task summaries", { cause: error });
  }

  const summariesByTask = new Map<string, AiTaskSummary>();

  for (const row of data.results) {
    const taskName = extractAiTaskName(row.tag);

    if (taskName) {
      const existingSummary = summariesByTask.get(taskName);
      const requestCount = row.requestCount ?? 0;

      summariesByTask.set(taskName, {
        requestCount: (existingSummary?.requestCount ?? 0) + requestCount,
        taskLabel: existingSummary?.taskLabel ?? formatAiTaskLabel(taskName),
        taskName,
      });
    }
  }

  return [...summariesByTask.values()].toSorted((left, right) => {
    if (right.requestCount !== left.requestCount) {
      return right.requestCount - left.requestCount;
    }

    return left.taskLabel.localeCompare(right.taskLabel);
  });
}
