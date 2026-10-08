import { type LanguageSummary, summarizeByLanguage } from "@/lib/case-languages";
import { meetsLatencyBudget } from "@/lib/latency";
import { getModelById, getModelFamily, getReasoningLabel } from "@/lib/models";
import { calculateScore } from "@/lib/score-calculation";
import { summarizeCategoryScores } from "@/lib/score-categories";
import { getStatsFromResults } from "@/lib/stats";
import { type CategoryScoreSummary, type RegisteredTask, type TaskEvalResults } from "@/lib/types";
import { type GatewayPrices } from "@zoonk/ai/pricing/gateway-prices";

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

  const totalScore = results.results.reduce(
    (acc, result) =>
      acc + calculateScore({ categoryScores: result.categoryScores, steps: result.steps }),
    0,
  );

  return totalScore / results.results.length;
}

export type LeaderboardEntry = {
  modelId: string;
  modelName: string;
  provider: string;
  reasoning: string;
  averageScore: number;
  /** Share of cases with the expected label, for classifiers only. */
  accuracy: number | null;
  latencyP50: number;
  latencyP95: number;
  /** Null when the task has no latency budget. */
  meetsLatencyBudget: boolean | null;
  costPer1000Runs: number;
  judgeCost: number;
  categoryScores: CategoryScoreSummary[];
  languages: LanguageSummary[];
};

export type SortKey =
  | "modelName"
  | "provider"
  | "reasoning"
  | "averageScore"
  | "latencyP50"
  | "latencyP95"
  | "costPer1000Runs";
export type SortDirection = "asc" | "desc";

/**
 * Build leaderboard entries from raw task evaluation results.
 * Filters out results whose model cannot be resolved.
 */
export function getLeaderboardEntries({
  prices,
  results,
  task,
}: {
  prices: GatewayPrices;
  results: TaskEvalResults[];
  task: Pick<RegisteredTask, "latencyBudget" | "testCases">;
}): LeaderboardEntry[] {
  return results.flatMap((result) => {
    const model = getModelById(result.modelId);

    if (!model) {
      return [];
    }

    const stats = getStatsFromResults({ evalResults: result, prices });

    return [
      {
        accuracy: stats.classification?.accuracy ?? null,
        averageScore: calculateAverageScore(result),
        categoryScores: summarizeCategoryScores(
          result.results.map((evalResult) => evalResult.categoryScores),
        ),
        costPer1000Runs: stats.costPer1000Runs,
        judgeCost: stats.judgeCost,
        languages: summarizeByLanguage({ results: result.results, testCases: task.testCases }),
        latencyP50: stats.latencyP50,
        latencyP95: stats.latencyP95,
        meetsLatencyBudget: meetsLatencyBudget({
          budget: task.latencyBudget,
          latency: { p50: stats.latencyP50, p95: stats.latencyP95 },
        }),
        modelId: result.modelId,
        modelName: model.name,
        provider: getModelFamily(model),
        // Evaluation adapters and image models run without reasoning.
        reasoning: model.kind === "generation" ? getReasoningLabel(model.reasoning) : "—",
      } satisfies LeaderboardEntry,
    ];
  });
}

const NUMERIC_SORT_KEYS = new Set<SortKey>([
  "averageScore",
  "costPer1000Runs",
  "latencyP50",
  "latencyP95",
]);

export function getDefaultSortDirection(key: SortKey): SortDirection {
  return NUMERIC_SORT_KEYS.has(key) ? "desc" : "asc";
}

/**
 * Compare two leaderboard entries for a given sort key.
 * Always returns values for ascending order; caller applies direction.
 * For averageScore: implements tie-breaker using p50 latency (faster wins ties).
 */
function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry, key: SortKey): number {
  if (key === "averageScore") {
    const aRounded = roundScoreToFixed(a.averageScore);
    const bRounded = roundScoreToFixed(b.averageScore);
    const byScore = aRounded - bRounded;

    if (byScore !== 0) {
      return byScore;
    }

    return b.latencyP50 - a.latencyP50;
  }

  if (key === "costPer1000Runs" || key === "latencyP50" || key === "latencyP95") {
    return a[key] - b[key];
  }

  // LocaleCompare for string fields
  return a[key].localeCompare(b[key]);
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
