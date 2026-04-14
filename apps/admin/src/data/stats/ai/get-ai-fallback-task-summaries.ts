import "server-only";
import { zoonkGateway } from "@zoonk/core/ai";
import { safeAsync } from "@zoonk/utils/error";
import { type AiTaskCatalogTask, listAiTaskCatalogTasks } from "./ai-task-catalog";
import { extractAiTaskName } from "./ai-task-stats";
import { getAiTaskUsageMap } from "./get-ai-task-usage-map";

type ActiveFallbackTask = AiTaskCatalogTask & {
  requestCount: number;
};

export type AiFallbackTaskSummary = {
  defaultModel: string;
  fallbackRate: number;
  fallbackRequestCount: number;
  requestCount: number;
  taskLabel: string;
  taskName: string;
};

type AiFallbackTaskSummaryReport = {
  activeTaskCount: number;
  fallbackRate: number;
  fallbackRequestCount: number;
  tasks: AiFallbackTaskSummary[];
  totalRequestCount: number;
};

/**
 * The cheapest exact cross-task fallback summary we can build with Gateway's
 * current reporting API is one task-usage query plus one grouped-tag query per
 * active default model. That lets us compare each task's total requests against
 * the subset that actually ran on its configured default model.
 */
export async function getAiFallbackTaskSummaries({
  endDate,
  startDate,
}: {
  endDate: string;
  startDate: string;
}): Promise<AiFallbackTaskSummaryReport> {
  const usageByTask = await getAiTaskUsageMap({ endDate, startDate });
  const activeTasks = getActiveFallbackTasks({ usageByTask });

  if (activeTasks.length <= 0) {
    return {
      activeTaskCount: 0,
      fallbackRate: 0,
      fallbackRequestCount: 0,
      tasks: [],
      totalRequestCount: 0,
    };
  }

  const defaultModelRequestCounts = await getDefaultModelRequestCounts({
    activeTasks,
    endDate,
    startDate,
  });
  const tasks = activeTasks
    .map((task) =>
      buildAiFallbackTaskSummary({
        defaultModelRequestCount: defaultModelRequestCounts.get(task.taskName) ?? 0,
        task,
      }),
    )
    .filter((task) => hasFallbackRequests(task))
    .toSorted(compareAiFallbackTaskSummaries);
  const fallbackRequestCount = sumFallbackRequestCounts(tasks);
  const totalRequestCount = sumActiveTaskRequestCounts(activeTasks);

  return {
    activeTaskCount: activeTasks.length,
    fallbackRate: calculateFallbackRate({
      fallbackRequestCount,
      requestCount: totalRequestCount,
    }),
    fallbackRequestCount,
    tasks,
    totalRequestCount,
  };
}

/**
 * Tasks without fallback routing or without any traffic in the selected period
 * cannot contribute to this report, so we drop them before issuing any model-
 * filtered Gateway queries.
 */
function getActiveFallbackTasks({
  usageByTask,
}: {
  usageByTask: Awaited<ReturnType<typeof getAiTaskUsageMap>>;
}) {
  return listAiTaskCatalogTasks().flatMap((task) =>
    getActiveFallbackTaskEntries({ task, usageByTask }),
  );
}

/**
 * Returning either one enriched task or nothing keeps the parent pipeline
 * linear and makes the inclusion rules explicit in one place.
 */
function getActiveFallbackTaskEntries({
  task,
  usageByTask,
}: {
  task: AiTaskCatalogTask;
  usageByTask: Awaited<ReturnType<typeof getAiTaskUsageMap>>;
}): ActiveFallbackTask[] {
  const usage = usageByTask[task.taskName];

  if (!task.supportsFallbackReporting || !usage || usage.requestCount <= 0) {
    return [];
  }

  return [{ ...task, requestCount: usage.requestCount }];
}

/**
 * Gateway can filter by actual served model while still grouping by tag. Grouping
 * active tasks by configured default model lets one query cover every task that
 * shares that default, which is much cheaper than opening one query per task.
 */
async function getDefaultModelRequestCounts({
  activeTasks,
  endDate,
  startDate,
}: {
  activeTasks: ActiveFallbackTask[];
  endDate: string;
  startDate: string;
}) {
  const tasksByDefaultModel = groupTasksByDefaultModel({ activeTasks });
  const defaultModelRequestCountMaps = await Promise.all(
    [...tasksByDefaultModel.entries()].map(([defaultModel, tasks]) =>
      getDefaultModelRequestCountMapForTaskGroup({
        defaultModel,
        endDate,
        startDate,
        tasks,
      }),
    ),
  );

  return mergeDefaultModelRequestCounts({ requestCountMaps: defaultModelRequestCountMaps });
}

/**
 * Tasks that share the same configured default model can reuse the same Gateway
 * query because we only need to know which of those tasks actually ran on that
 * model in the selected period.
 */
function groupTasksByDefaultModel({ activeTasks }: { activeTasks: ActiveFallbackTask[] }) {
  const groups = new Map<string, ActiveFallbackTask[]>();

  for (const task of activeTasks) {
    const existingTasks = groups.get(task.defaultModel) ?? [];
    groups.set(task.defaultModel, [...existingTasks, task]);
  }

  return groups;
}

/**
 * Filtering the report by the configured default model yields the subset of
 * requests that stayed on their default path. Subtracting those counts from the
 * per-task totals gives us the fallback counts without a task-by-task drill-down.
 */
async function getDefaultModelRequestCountMapForTaskGroup({
  defaultModel,
  endDate,
  startDate,
  tasks,
}: {
  defaultModel: string;
  endDate: string;
  startDate: string;
  tasks: ActiveFallbackTask[];
}) {
  const { data, error } = await safeAsync(() =>
    zoonkGateway.getSpendReport({
      endDate,
      groupBy: "tag",
      model: defaultModel,
      startDate,
    }),
  );

  if (error) {
    throw new Error(`Failed to load default-model usage for ${defaultModel}`, { cause: error });
  }

  return buildDefaultModelRequestCountMap({
    rows: data.results,
    taskNames: tasks.map((task) => task.taskName),
  });
}

/**
 * The model-filtered tag report still includes non-task tags. We keep only the
 * task rows we care about for the current default-model group.
 */
function buildDefaultModelRequestCountMap({
  rows,
  taskNames,
}: {
  rows: Awaited<ReturnType<typeof zoonkGateway.getSpendReport>>["results"];
  taskNames: string[];
}) {
  const taskNameSet = new Set(taskNames);
  const requestCounts = new Map<string, number>();

  for (const row of rows) {
    const taskName = extractAiTaskName(row.tag);

    if (taskName && taskNameSet.has(taskName)) {
      requestCounts.set(taskName, row.requestCount ?? 0);
    }
  }

  return requestCounts;
}

/**
 * Each default-model query returns a map for the tasks that share that model.
 * Merging those maps once here keeps the main loader linear and avoids unsafe
 * casts around `Object.assign`.
 */
function mergeDefaultModelRequestCounts({
  requestCountMaps,
}: {
  requestCountMaps: Map<string, number>[];
}) {
  const requestCounts = new Map<string, number>();

  for (const requestCountMap of requestCountMaps) {
    for (const [taskName, requestCount] of requestCountMap.entries()) {
      requestCounts.set(taskName, requestCount);
    }
  }

  return requestCounts;
}

/**
 * The fallback summary is centered on how many requests missed the configured
 * default model for a task, plus the share of traffic that represents.
 */
function buildAiFallbackTaskSummary({
  defaultModelRequestCount,
  task,
}: {
  defaultModelRequestCount: number;
  task: ActiveFallbackTask;
}) {
  const defaultRequestCount = Math.min(defaultModelRequestCount, task.requestCount);
  const fallbackRequestCount = Math.max(task.requestCount - defaultRequestCount, 0);

  return {
    defaultModel: task.defaultModel,
    fallbackRate: calculateFallbackRate({
      fallbackRequestCount,
      requestCount: task.requestCount,
    }),
    fallbackRequestCount,
    requestCount: task.requestCount,
    taskLabel: task.taskLabel,
    taskName: task.taskName,
  } satisfies AiFallbackTaskSummary;
}

/**
 * Rows with zero fallback requests are not helpful on the summary page, so we
 * drop them and keep the report focused on the tasks that actually fell back.
 */
function hasFallbackRequests(task: AiFallbackTaskSummary) {
  return task.fallbackRequestCount > 0;
}

/**
 * The most important tasks are the ones with the largest fallback volume. When
 * counts tie, the report falls back to rate and then to a stable label order.
 */
function compareAiFallbackTaskSummaries(left: AiFallbackTaskSummary, right: AiFallbackTaskSummary) {
  if (right.fallbackRequestCount !== left.fallbackRequestCount) {
    return right.fallbackRequestCount - left.fallbackRequestCount;
  }

  if (right.fallbackRate !== left.fallbackRate) {
    return right.fallbackRate - left.fallbackRate;
  }

  return left.taskLabel.localeCompare(right.taskLabel);
}

/**
 * The top-level cards need the report-wide fallback volume, so we sum the task
 * rows once here instead of recalculating it inside the component tree.
 */
function sumFallbackRequestCounts(tasks: AiFallbackTaskSummary[]) {
  return tasks.reduce((sum, task) => sum + task.fallbackRequestCount, 0);
}

/**
 * We compare fallback volume against the total traffic for active fallback-
 * capable tasks in the period, not against the whole task catalog.
 */
function sumActiveTaskRequestCounts(tasks: ActiveFallbackTask[]) {
  return tasks.reduce((sum, task) => sum + task.requestCount, 0);
}

/**
 * Both the per-task rows and the report summary need the same normalized rate.
 * Returning zero for empty totals keeps the UI stable for quiet periods.
 */
function calculateFallbackRate({
  fallbackRequestCount,
  requestCount,
}: {
  fallbackRequestCount: number;
  requestCount: number;
}) {
  if (requestCount <= 0) {
    return 0;
  }

  return fallbackRequestCount / requestCount;
}
