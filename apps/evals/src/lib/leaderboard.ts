import { type LanguageSummary, summarizeByLanguage } from "@/lib/case-languages";
import { type EvalSummary, aggregateEvalResults } from "@/lib/eval-summary";
import { meetsLatencyBudget } from "@/lib/latency";
import { getModelById, getModelFamily, getReasoningLabel } from "@/lib/models";
import { summarizeCategoryScores } from "@/lib/score-categories";
import { getStatsFromResults } from "@/lib/stats";
import { type CategoryScoreSummary, type RegisteredTask, type TaskEvalResults } from "@/lib/types";
import { type GatewayPrices } from "@zoonk/ai/pricing/gateway-prices";

export type LeaderboardEntry = {
  modelId: string;
  modelName: string;
  provider: string;
  reasoning: string;
  averageScore: number | null;
  summary: EvalSummary;
  accuracy: number | null;
  latencyP50: number | null;
  latencyP95: number | null;
  meetsLatencyBudget: boolean | null;
  costPer1000Runs: number | null;
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
    const summary = aggregateEvalResults(result);

    return [
      {
        accuracy: stats.classification?.accuracy ?? null,
        averageScore: summary.averageScore,
        categoryScores: summarizeCategoryScores(
          result.results.map((evalResult) => evalResult.categoryScores),
        ),
        costPer1000Runs: summary.scored === 0 ? null : stats.costPer1000Runs,
        judgeCost: stats.judgeCost,
        languages: summarizeByLanguage({ results: result.results, testCases: task.testCases }),
        latencyP50: summary.scored === 0 ? null : stats.latencyP50,
        latencyP95: summary.scored === 0 ? null : stats.latencyP95,
        meetsLatencyBudget:
          summary.scored === 0
            ? null
            : meetsLatencyBudget({
                budget: task.latencyBudget,
                latency: { p50: stats.latencyP50, p95: stats.latencyP95 },
              }),
        modelId: result.modelId,
        modelName: model.name,
        provider: getModelFamily(model),
        reasoning: model.kind === "generation" ? getReasoningLabel(model.reasoning) : "—",
        summary,
      } satisfies LeaderboardEntry,
    ];
  });
}
