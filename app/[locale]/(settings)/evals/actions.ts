"use server";

import {
  runCourseSuggestionsEval,
  saveEvalResults,
} from "@/ai/evals/course-suggestions-eval";
import { updateLeaderboard } from "@/ai/evals/leaderboard";
import type { ModelConfig } from "@/ai/evals/models";
import { EVAL_MODELS } from "@/ai/evals/models";

export async function runEval(modelId: string) {
  const model = EVAL_MODELS.find((m) => m.id === modelId);

  if (!model) {
    throw new Error(`Model not found: ${modelId}`);
  }

  const result = await runCourseSuggestionsEval(model);

  await saveEvalResults(result);
  await updateLeaderboard(result);

  return {
    success: true,
    modelName: model.name,
    averageScore: result.averageScore,
    medianScore: result.medianScore,
    avgCostPer100: result.avgCostPer100,
  };
}

export async function getAvailableModels(): Promise<ModelConfig[]> {
  return EVAL_MODELS;
}
