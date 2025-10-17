import { getModelById, getModelDisplayName } from "@/lib/models";
import { getStatsFromResults } from "@/lib/stats";
import type { TaskEvalResults } from "@/lib/types";

export interface LeaderboardEntry {
  modelId: string;
  modelName: string;
  provider: string;
  averageScore: number;
  totalCost: number;
}

export type SortKey = "modelName" | "provider" | "averageScore" | "totalCost";
export type SortDirection = "asc" | "desc";

/**
 * Build leaderboard entries from raw task evaluation results.
 * Filters out results whose model cannot be resolved.
 */
export function getLeaderboardEntries(
  results: TaskEvalResults[],
): LeaderboardEntry[] {
  return results
    .map((result) => {
      const model = getModelById(result.modelId);

      if (!model) {
        return null;
      }

      const stats = getStatsFromResults(result);

      return {
        modelId: result.modelId,
        modelName: getModelDisplayName(model),
        provider: result.modelId.split("/")[0],
        averageScore: stats.averageScore,
        totalCost: stats.totalCost,
      } satisfies LeaderboardEntry;
    })
    .filter(Boolean) as LeaderboardEntry[];
}

export function getDefaultSortDirection(key: SortKey): SortDirection {
  return key === "averageScore" ? "desc" : "asc";
}

/**
 * Compare two leaderboard entries for a given sort key.
 * Always returns values for ascending order; caller applies direction.
 * For averageScore: implements tie-breaker using totalCost (lower cost wins ties).
 */
export function compareEntries(
  a: LeaderboardEntry,
  b: LeaderboardEntry,
  key: SortKey,
): number {
  if (key === "averageScore") {
    const byScore = a.averageScore - b.averageScore; // ascending by score
    if (byScore !== 0) {
      return byScore;
    }
    // tie-breaker: lower total cost first
    return a.totalCost - b.totalCost;
  }

  if (key === "totalCost") {
    return a.totalCost - b.totalCost;
  }

  // localeCompare for string fields
  return String(a[key]).localeCompare(String(b[key]));
}

/**
 * Returns a new array sorted according to the provided key and direction.
 */
export function sortLeaderboardEntries(
  entries: LeaderboardEntry[],
  key: SortKey,
  direction: SortDirection,
): LeaderboardEntry[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...entries].sort(
    (left, right) => sign * compareEntries(left, right, key),
  );
}
