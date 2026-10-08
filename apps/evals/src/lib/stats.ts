import { type GatewayPrices } from "@zoonk/ai/pricing/gateway-prices";
import { type ClassificationSummary, summarizeClassification } from "./classification-metrics";
import { estimateCostPer1000Runs, getCallCost } from "./cost";
import { summarizeLatency } from "./latency";
import { average, sum } from "./math";
import { getModelById } from "./models";
import { type EvalResult, type TaskEvalResults } from "./types";

export type TaskStats = {
  averageInputTokens: number;
  averageOutputTokens: number;
  latencyP50: number;
  latencyP95: number;
  /** What 1,000 runs would cost at this model's average usage. */
  costPer1000Runs: number;
  /** What generating these outputs actually cost. */
  runCost: number;
  /** What scoring these outputs actually cost. Zero for code-scored tasks. */
  judgeCost: number;
  classification: ClassificationSummary | null;
};

function getJudgeCost({ prices, result }: { prices: GatewayPrices; result: EvalResult }): number {
  if (!result.judge) {
    return 0;
  }

  return getCallCost({ modelId: result.judge.modelId, prices, usage: result.judge.usage });
}

/**
 * Summarizes one model's scored results with gateway prices: cached input and
 * reasoning tokens use the rates the gateway bills, and latency is reported
 * as p50 and p95 because learners wait on the tail, not the average.
 */
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
   * Transcription is billed per minute of audio and GPT-Live per second of session, which token
   * prices can't express.
   */
  const runCosts =
    model.kind === "transcription" || model.kind === "realtime"
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
    judgeCost: sum(results.map((result) => getJudgeCost({ prices, result }))),
    latencyP50: latency.p50,
    latencyP95: latency.p95,
    runCost: sum(runCosts),
  };
}
