import { RUNS_PER_TEST_CASE, getTaskById } from "@/tasks";
import { getTaskResults } from "./eval-runner";
import { EVAL_MODELS, type ModelConfig } from "./models";
import { getAllOutputsForTask, getOutputStatus } from "./output-loader";
import { getTestCaseRunProgress } from "./test-case-runs";
import { type RegisteredTask, type TaskEvalResults } from "./types";

export type ModelStatus = "completed" | "outputsReady" | "incomplete" | "notStarted";

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

  if (completedRuns === totalRuns && totalRuns > 0) {
    return "completed";
  }

  if (completedRuns > 0) {
    return "incomplete";
  }

  if (outputStatus.status === "complete") {
    return "outputsReady";
  }

  return "notStarted";
}

function supportsModel(task: RegisteredTask, model: ModelConfig): boolean {
  if (
    task.output ||
    model.kind === "image" ||
    model.kind === "speech" ||
    model.kind === "transcription"
  ) {
    return task.output === model.kind;
  }

  return model.kind === "generation" || Boolean(task.evaluate);
}

export async function getSortedModels(task: RegisteredTask) {
  const modelWithStatus = await Promise.all(
    EVAL_MODELS.filter((model) => supportsModel(task, model)).map(async (model) => ({
      model,
      status: await getModelStatus(task.id, model.id),
    })),
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

export async function getModelsWithResults(taskId: string): Promise<TaskEvalResults[]> {
  const allOutputs = await getAllOutputsForTask(taskId);

  const results = await Promise.all(
    [...allOutputs.keys()].map(async (modelId) => {
      const res = await getTaskResults(taskId, modelId);
      return res;
    }),
  );

  return results.filter((result): result is TaskEvalResults => Boolean(result));
}
