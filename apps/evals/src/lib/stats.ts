import { type GatewayPrices } from "@zoonk/ai/pricing/gateway-prices";
import { type ClassificationSummary, summarizeClassification } from "./classification-metrics";
import { estimateCostPer1000Runs, getCallCost } from "./cost";
import { summarizeLatency } from "./latency";
import { average, sum } from "./math";
import { getModelById } from "./models";
import { type ModelCall, type TaskEvalResults } from "./types";

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

function getCallsCost({ calls, prices }: { calls: ModelCall[]; prices: GatewayPrices }): number {
  return sum(
    calls.map((call) => getCallCost({ modelId: call.modelId, prices, usage: call.usage })),
  );
}

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

  const { results } = evalResults;

  /**
   * Transcription is billed per minute of audio and speech per second of audio or per character,
   * which token prices cannot express.
   */
  const runCosts =
    model.kind === "transcription" || model.kind === "speech"
      ? []
      : results.map((result) =>
          getCallCost({ modelId: model.gatewayModelId, prices, usage: result }),
        );

  const latency = summarizeLatency(results.map((result) => result.duration));

  return {
    averageInputTokens: average(results.map((result) => result.inputTokens)),
    averageOutputTokens: average(results.map((result) => result.outputTokens)),
    classification: summarizeClassification(
      results.flatMap((result) => (result.classification ? [result.classification] : [])),
    ),
    costPer1000Runs: estimateCostPer1000Runs(runCosts),
    extraCost: getCallsCost({
      calls: results.flatMap((result) => result.extraCalls ?? []),
      prices,
    }),
    judgeCost: getCallsCost({ calls: results.flatMap((result) => result.judge ?? []), prices }),
    latencyP50: latency.p50,
    latencyP95: latency.p95,
    runCost: sum(runCosts),
  };
}
