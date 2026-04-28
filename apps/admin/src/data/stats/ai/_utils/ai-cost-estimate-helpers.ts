import {
  type TaskUsageByName,
  calculateAverageRequestsPerEntity,
  estimateGeminiTtsCost,
  formatAiTaskLabel,
} from "../ai-task-stats";
import { LANGUAGE_TTS_HEURISTIC_NOTE } from "./ai-cost-estimate-constants";
import { type EstimateLineItem } from "./ai-cost-estimate-types";

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
 * The raw SQL helpers return bigint counts from Postgres. Converting them in one
 * place keeps the structure loader focused on domain values instead of database
 * transport types.
 */
export function toNumber(value?: bigint | number | null): number {
  if (typeof value === "bigint") {
    return Number(value);
  }

  return value ?? 0;
}
