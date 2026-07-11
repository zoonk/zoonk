import { RUNS_PER_TEST_CASE, getTaskById } from "@/tasks";
import { getTaskResults } from "./eval-runner";
import { EVAL_MODELS } from "./models";
import { getOutputStatus } from "./output-loader";
import { getTestCaseRunProgress } from "./test-case-runs";
import { type TaskEvalResults } from "./types";

export type ModelStatus = "completed" | "outputsReady" | "incomplete" | "notStarted";

/**
 * Classifies a model against the task's currently required run ids so saved
 * results from old runs or removed cases cannot hide newly added test cases.
 */
export async function getModelStatus(taskId: string, modelId: string): Promise<ModelStatus> {
  const task = getTaskById(taskId);

  if (!task) {
    return "notStarted";
  }

  const [results, outputStatus] = await Promise.all([
    getTaskResults(taskId, modelId),
    getOutputStatus({ modelId, runsPerTestCase: RUNS_PER_TEST_CASE, task }),
  ]);

  const { completedRuns, totalRuns } = getTestCaseRunProgress({
    completedRunIds: results?.results.map((result) => result.testCase.id) ?? [],
    runsPerTestCase: RUNS_PER_TEST_CASE,
    testCases: task.testCases,
  });

  // Has eval results
  if (completedRuns === totalRuns && totalRuns > 0) {
    return "completed";
  }

  // Has partial eval results
  if (completedRuns > 0) {
    return "incomplete";
  }

  // Has outputs but no eval results
  if (outputStatus.status === "complete") {
    return "outputsReady";
  }

  return "notStarted";
}

// Fetch model statuses and sort: notStarted -> outputsReady -> incomplete (filter out completed)
export async function getSortedModels(taskId: string) {
  const modelWithStatus = await Promise.all(
    EVAL_MODELS.map(async (model) => ({ model, status: await getModelStatus(taskId, model.id) })),
  );

  const order: Record<ModelStatus, number> = {
    completed: 3,
    incomplete: 2,
    notStarted: 0,
    outputsReady: 1,
  };

  const sortedModels = modelWithStatus
    .filter((x) => x.status !== "completed")
    .toSorted((a, b) => {
      const aStatus = a.status;
      const bStatus = b.status;
      return order[aStatus] - order[bStatus];
    })
    .map((x) => x.model);

  return sortedModels;
}

// Filter out models without any results
export async function getModelsWithResults(taskId: string): Promise<TaskEvalResults[]> {
  const results = await Promise.all(
    EVAL_MODELS.map(async (model) => {
      const res = await getTaskResults(taskId, model.id);
      return res;
    }),
  );

  return results.filter((result): result is TaskEvalResults => Boolean(result));
}
