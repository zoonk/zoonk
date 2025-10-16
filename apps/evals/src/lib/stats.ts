import { getModelById } from "./models";
import type { EvalResult, TaskEvalResults } from "./types";

const TOKENS_PER_MILLION = 1_000_000;
const COST_MULTIPLIER = 1000;

export interface TaskStats {
  averageScore: number;
  averageInputTokens: number;
  averageOutputTokens: number;
  totalCost: number;
}

export function calculateStats(
  results: EvalResult[],
  modelId: string,
): TaskStats {
  if (results.length === 0) {
    return {
      averageScore: 0,
      averageInputTokens: 0,
      averageOutputTokens: 0,
      totalCost: 0,
    };
  }

  const model = getModelById(modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }

  const averageScore =
    results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const averageInputTokens =
    results.reduce((sum, r) => sum + r.inputTokens, 0) / results.length;
  const averageOutputTokens =
    results.reduce((sum, r) => sum + r.outputTokens, 0) / results.length;

  const costPerMultipleRuns =
    ((averageInputTokens * model.inputCost) / TOKENS_PER_MILLION +
      (averageOutputTokens * model.outputCost) / TOKENS_PER_MILLION) *
    COST_MULTIPLIER;

  return {
    averageScore,
    averageInputTokens,
    averageOutputTokens,
    totalCost: costPerMultipleRuns,
  };
}

export function getStatsFromResults(evalResults: TaskEvalResults): TaskStats {
  return calculateStats(evalResults.results, evalResults.modelId);
}
