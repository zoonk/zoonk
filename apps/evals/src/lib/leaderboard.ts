import { type LanguageSummary, summarizeByLanguage } from "@/lib/case-languages";
import { meetsLatencyBudget } from "@/lib/latency";
import { getModelById, getModelFamily, getReasoningLabel } from "@/lib/models";
import { calculateScore } from "@/lib/score-calculation";
import { summarizeCategoryScores } from "@/lib/score-categories";
import { getStatsFromResults } from "@/lib/stats";
import { type CategoryScoreSummary, type RegisteredTask, type TaskEvalResults } from "@/lib/types";
import { type GatewayPrices } from "@zoonk/ai/pricing/gateway-prices";

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
  accuracy: number | null;
  latencyP50: number;
  latencyP95: number;
  meetsLatencyBudget: boolean | null;
  costPer1000Runs: number;
  judgeCost: number;
  categoryScores: CategoryScoreSummary[];
  languages: LanguageSummary[];
};

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
        reasoning: model.kind === "generation" ? getReasoningLabel(model.reasoning) : "—",
      } satisfies LeaderboardEntry,
    ];
  });
}
