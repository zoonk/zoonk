import { getTotalTestCases } from "@/tasks";
import { getTaskResults } from "./eval-runner";
import { EVAL_MODELS } from "./models";
import type { TaskEvalResults } from "./types";

export type ModelStatus = "completed" | "incomplete" | "notStarted";

export async function getModelStatus(
  taskId: string,
  modelId: string,
): Promise<ModelStatus> {
  const results = await getTaskResults(taskId, modelId);
  const resultsCount = results?.results.length ?? 0;
  const totalTestCases = getTotalTestCases(taskId);

  if (resultsCount >= totalTestCases && totalTestCases > 0) {
    return "completed";
  }

  if (resultsCount > 0 && resultsCount < totalTestCases) {
    return "incomplete";
  }

  return "notStarted";
}

// Fetch model statuses and sort: notStarted -> incomplete (filter out completed)
export async function getSortedModels(taskId: string) {
  const modelWithStatus = await Promise.all(
    EVAL_MODELS.map(async (model) => ({
      model,
      status: await getModelStatus(taskId, model.id),
    })),
  );

  const order: Record<ModelStatus, number> = {
    notStarted: 0,
    incomplete: 1,
    completed: 2,
  };

  const sortedModels = modelWithStatus
    .filter((x) => x.status !== "completed")
    .sort((a, b) => {
      const aStatus = a.status as ModelStatus;
      const bStatus = b.status as ModelStatus;
      return order[aStatus] - order[bStatus];
    })
    .map((x) => x.model);

  return sortedModels;
}

// Filter out models without any results
export async function getModelsWithResults(
  taskId: string,
): Promise<TaskEvalResults[]> {
  const results = await Promise.all(
    EVAL_MODELS.map(async (model) => {
      const res = await getTaskResults(taskId, model.id);
      return res;
    }),
  );

  return results.filter((result): result is TaskEvalResults => Boolean(result));
}
