import { type GatewayPrices } from "@zoonk/ai/pricing/gateway-prices";
import { type ClassificationSummary, summarizeClassification } from "./classification-metrics";
import { estimateCostPer1000Runs, getCallsCost, getFailedRunsCost, getRunCost } from "./cost";
import { summarizeLatency } from "./latency";
import { average, sum } from "./math";
import { getModelById } from "./models";
import { type TaskEvalResults } from "./types";

export type TaskStats = {
  averageInputTokens: number;
  averageOutputTokens: number;
  latencyP50: number;
  latencyP95: number;
  costPer1000Runs: number;
  runCost: number;
  judgeCost: number;
  extraCost: number;
  classification: ClassificationSummary | null;
};

export function getSpent(stats: Pick<TaskStats, "extraCost" | "judgeCost" | "runCost">): number {
  return stats.runCost + stats.judgeCost + stats.extraCost;
}

export function getStatsFromResults({
  evalResults,
  prices,
}: {
  evalResults: TaskEvalResults;
  prices: GatewayPrices;
}): TaskStats {
  const model = getModelById(evalResults.modelId);

  if (!model) {
    throw new Error(`Model ${evalResults.modelId} not found`);
  }

  const { failedRuns = [], results } = evalResults;
  const failedCost = getFailedRunsCost({ failedRuns, prices });

  /**
   * Transcription is billed per minute of audio and speech per second of audio or per character,
   * which token prices cannot express.
   */
  const runCosts =
    model.kind === "transcription" || model.kind === "speech"
      ? []
      : results.map((result) => getRunCost({ model, prices, run: result }));

  const latency = summarizeLatency(results.map((result) => result.duration));

  return {
    averageInputTokens: average(results.map((result) => result.inputTokens)),
    averageOutputTokens: average(results.map((result) => result.outputTokens)),
    classification: summarizeClassification(
      results.flatMap((result) => (result.classification ? [result.classification] : [])),
    ),
    costPer1000Runs: estimateCostPer1000Runs({ failedCost, runCosts }),
    extraCost: getCallsCost({
      calls: [...results, ...failedRuns].flatMap((run) => run.extraCalls ?? []),
      prices,
    }),
    judgeCost: getCallsCost({ calls: results.flatMap((result) => result.judge ?? []), prices }),
    latencyP50: latency.p50,
    latencyP95: latency.p95,
    runCost: sum(runCosts) + failedCost,
  };
}
