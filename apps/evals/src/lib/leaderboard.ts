import { getModelById, getModelDisplayName } from "@/lib/models";
import { calculateScore } from "@/lib/score";
import { getStatsFromResults } from "@/lib/stats";
import type { TaskEvalResults } from "@/lib/types";

function roundScoreToFixed(score: number): number {
  return Number(score.toFixed(2));
}

/**
 * Calculates the average score for a task's eval results.
 * Computes the weighted score for each result and returns the mean.
 */
export function calculateAverageScore(results: TaskEvalResults): number {
  if (results.results.length === 0) {
    return 0;
  }

  const totalScore = results.results.reduce((acc, result) => acc + calculateScore(result.steps), 0);

  return totalScore / results.results.length;
}

export type LeaderboardEntry = {
  modelId: string;
  modelName: string;
  provider: string;
  averageScore: number;
  averageDuration: number;
  totalCost: number;
};

export type SortKey = "modelName" | "provider" | "averageScore" | "averageDuration" | "totalCost";
export type SortDirection = "asc" | "desc";

/**
 * Build leaderboard entries from raw task evaluation results.
 * Filters out results whose model cannot be resolved.
 */
export function getLeaderboardEntries(results: TaskEvalResults[]): LeaderboardEntry[] {
  return results
    .map((result) => {
      const model = getModelById(result.modelId);

      if (!model) {
        return null;
      }

      const stats = getStatsFromResults(result);

      return {
        averageDuration: stats.averageDuration,
        averageScore: calculateAverageScore(result),
        modelId: result.modelId,
        modelName: getModelDisplayName(model),
        provider: result.modelId.split("/")[0] ?? result.modelId,
        totalCost: stats.totalCost,
      } satisfies LeaderboardEntry;
    })
    .filter(Boolean) as LeaderboardEntry[];
}

export function getDefaultSortDirection(key: SortKey): SortDirection {
  return key === "averageScore" || key === "totalCost" || key === "averageDuration"
    ? "desc"
    : "asc";
}

/**
 * Compare two leaderboard entries for a given sort key.
 * Always returns values for ascending order; caller applies direction.
 * For averageScore: implements tie-breaker using totalCost (lower cost wins ties).
 */
function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry, key: SortKey): number {
  if (key === "averageScore") {
    const aRounded = roundScoreToFixed(a.averageScore);
    const bRounded = roundScoreToFixed(b.averageScore);
    const byScore = aRounded - bRounded;

    if (byScore !== 0) {
      return byScore;
    }
    // tie-breaker: lower total cost first
    return b.totalCost - a.totalCost;
  }

  if (key === "totalCost" || key === "averageDuration") {
    return a[key] - b[key];
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
  return [...entries].toSorted((left, right) => sign * compareEntries(left, right, key));
}
