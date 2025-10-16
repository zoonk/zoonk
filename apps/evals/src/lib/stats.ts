import { getModelById, type ModelConfig } from "./models";
import type { EvalResult, TaskEvalResults } from "./types";

const TOKENS_PER_MILLION = 1_000_000;
const COST_MULTIPLIER = 1000;

interface TaskStats {
  averageScore: number;
  averageInputTokens: number;
  averageOutputTokens: number;
  totalCost: number;
}

function calculateAverage(
  results: EvalResult[],
  key: keyof EvalResult,
): number {
  if (results.length === 0) {
    return 0;
  }

  const total = results.reduce((sum, result) => sum + result[key], 0);

  return total / results.length;
}

function calculateCost(tokens, cost): number {
  return (tokens / TOKENS_PER_MILLION) * cost * COST_MULTIPLIER;
}

function calculateTotalCost(
  inputTokens: number,
  outputTokens: number,
  model: ModelConfig,
): number {
  const { inputCost, outputCost } = model;

  const totalInputCost = calculateCost(inputTokens, inputCost);
  const totalOutputCost = calculateCost(outputTokens, outputCost);

  return totalInputCost + totalOutputCost;
}

function calculateStats(results: EvalResult[], modelId: string): TaskStats {
  const model = getModelById(modelId);

  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }

  const averageScore = calculateAverage(results, "score");
  const averageInputTokens = calculateAverage(results, "inputTokens");
  const averageOutputTokens = calculateAverage(results, "outputTokens");

  const totalCost = calculateTotalCost(
    averageInputTokens,
    averageOutputTokens,
    model,
  );

  return {
    averageScore,
    averageInputTokens,
    averageOutputTokens,
    totalCost,
  };
}

export function getStatsFromResults(evalResults: TaskEvalResults): TaskStats {
  return calculateStats(evalResults.results, evalResults.modelId);
}
