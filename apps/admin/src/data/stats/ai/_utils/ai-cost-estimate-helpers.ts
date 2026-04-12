import {
  type TaskUsageByName,
  calculateAverageRequestsPerEntity,
  estimateGeminiTtsCost,
  formatAiTaskLabel,
} from "../ai-task-stats";
import { LANGUAGE_TTS_HEURISTIC_NOTE, VISUAL_TASK_BY_KIND } from "./ai-cost-estimate-constants";
import {
  type EstimateLineItem,
  type StructureStats,
  type VisualUsageRow,
} from "./ai-cost-estimate-types";

/**
 * The UI cards show one total, but the totals should still be explainable. Each
 * Gateway line item keeps the original task name, the per-request cost, and the
 * normalized number of requests we expect for one lesson or course.
 */
export function buildGatewayLineItem({
  averageRequestsPerRun,
  taskName,
  usageByTask,
}: {
  averageRequestsPerRun: number;
  taskName: string;
  usageByTask: TaskUsageByName;
}): EstimateLineItem | null {
  if (averageRequestsPerRun <= 0) {
    return null;
  }

  const usage = usageByTask[taskName];
  const averageCostPerRequest = usage?.averageMarketCostPerRequest ?? 0;

  return {
    averageCostPerRequest,
    averageRequestsPerRun,
    estimatedCost: averageRequestsPerRun * averageCostPerRequest,
    hasUsageData: Boolean(usage && usage.requestCount > 0),
    isInferred: false,
    label: formatAiTaskLabel(taskName),
    taskName,
  };
}

/**
 * Some costs do not map to a single Gateway task. Aggregate line items keep
 * those costs visible in the breakdown without pretending there was one
 * underlying task row.
 */
export function buildAggregateLineItem({
  averageRequestsPerRun,
  estimatedCost,
  label,
  note,
}: {
  averageRequestsPerRun: number;
  estimatedCost: number;
  label: string;
  note?: string;
}): EstimateLineItem | null {
  if (averageRequestsPerRun <= 0 || estimatedCost <= 0) {
    return null;
  }

  return {
    averageCostPerRequest: estimatedCost / averageRequestsPerRun,
    averageRequestsPerRun,
    estimatedCost,
    hasUsageData: true,
    isInferred: true,
    label,
    note,
  };
}

/**
 * Language audio clips sit outside Gateway. Surfacing the TTS estimate as its
 * own line item makes that approximation explicit instead of burying it inside
 * the lesson total.
 */
export function buildTtsLineItem({
  totalAudioSeconds,
  totalInputWordCount,
}: {
  totalAudioSeconds: number;
  totalInputWordCount: number;
}): EstimateLineItem | null {
  if (totalAudioSeconds <= 0 || totalInputWordCount <= 0) {
    return null;
  }

  return {
    averageCostPerRequest: 0,
    averageRequestsPerRun: totalAudioSeconds,
    estimatedCost: estimateGeminiTtsCost({ totalAudioSeconds, totalInputWordCount }),
    hasUsageData: true,
    isInferred: true,
    label: "Estimated TTS audio",
    note: LANGUAGE_TTS_HEURISTIC_NOTE,
  };
}

/**
 * Visual dispatch requests map one-to-one to persisted visual rows, so the
 * database is the most reliable way to attribute those shared tasks back to
 * core explanations versus custom activities.
 */
export function buildVisualLineItems({
  activityKind,
  entityCount,
  structureStats,
  usageByTask,
}: {
  activityKind: "custom" | "explanation";
  entityCount: number;
  structureStats: StructureStats;
  usageByTask: TaskUsageByName;
}): EstimateLineItem[] {
  return Object.entries(VISUAL_TASK_BY_KIND)
    .map(([visualKind, taskName]) =>
      buildGatewayLineItem({
        averageRequestsPerRun: calculateAverageRequestsPerEntity({
          entityCount,
          requestCount: structureStats.visualCountsByKey[`${activityKind}:${visualKind}`] ?? 0,
        }),
        taskName,
        usageByTask,
      }),
    )
    .filter((item): item is EstimateLineItem => item !== null);
}

/**
 * The workflow guarantees one applied activity slot in core lessons, but
 * historical data can still be sparse or messy. Normalizing the
 * story/investigation mix back to one slot keeps the estimate aligned with the
 * product rule the admin cares about.
 */
export function getAppliedActivityShares({
  investigationCount,
  storyCount,
}: {
  investigationCount: number;
  storyCount: number;
}): { investigationShare: number; storyShare: number } {
  const totalAppliedActivities = storyCount + investigationCount;

  if (totalAppliedActivities <= 0) {
    return { investigationShare: 0.5, storyShare: 0.5 };
  }

  return {
    investigationShare: investigationCount / totalAppliedActivities,
    storyShare: storyCount / totalAppliedActivities,
  };
}

/**
 * Some workflows use historical task counts directly instead of persisted
 * content records. This helper centralizes the "requests per entity" math so
 * the builders all normalize task usage the same way.
 */
export function getAverageTaskRequestsPerRun({
  entityCount,
  taskName,
  usageByTask,
}: {
  entityCount: number;
  taskName: string;
  usageByTask: TaskUsageByName;
}): number {
  return calculateAverageRequestsPerEntity({
    entityCount,
    requestCount: usageByTask[taskName]?.requestCount ?? 0,
  });
}

/**
 * Every estimate ultimately rolls up into one currency number, so this helper
 * keeps the final sum consistent across lesson and course builders.
 */
export function sumLineItems(items: EstimateLineItem[]): number {
  return items.reduce((sum, item) => sum + item.estimatedCost, 0);
}

/**
 * Most estimate builders assemble arrays with optional line items. This keeps
 * those builders readable while still giving TypeScript a concrete
 * `EstimateLineItem[]` before totals are calculated.
 */
export function isEstimateLineItem(item: EstimateLineItem | null): item is EstimateLineItem {
  return item !== null;
}

/**
 * The SQL visual query returns one row per activity-kind and visual-kind pair.
 * Flattening that into a predictable key-value map keeps the estimate builders
 * free from row-scanning logic and makes missing combinations naturally fall
 * back to zero.
 */
export function buildVisualCountMap(rows: VisualUsageRow[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const row of rows) {
    const visualKind = row.visualKind ?? "image";
    const key = `${row.activityKind}:${visualKind}`;
    counts[key] = toNumber(row.count);
  }

  return counts;
}

/**
 * The raw SQL helpers return bigint counts from Postgres. Converting them in one
 * place keeps the structure loader focused on domain values instead of database
 * transport types.
 */
export function toNumber(value: bigint | number | null | undefined): number {
  if (typeof value === "bigint") {
    return Number(value);
  }

  return value ?? 0;
}
