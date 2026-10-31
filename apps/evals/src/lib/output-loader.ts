import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { getBaseTestCaseId, getTestCaseRunProgress } from "./test-case-runs";
import {
  type ModelOutputs,
  type OutputEntry,
  type RegisteredTask,
  type TaskModelOutputResults,
  type TestCase,
} from "./types";

const EVAL_RESULTS_DIR = path.join(process.cwd(), "eval-results");
const OUTPUTS_DIR = path.join(EVAL_RESULTS_DIR, "outputs");

function getOutputsFilePath(taskId: string, modelId: string): string {
  const modelPath = modelId.replaceAll("/", "-");
  return path.join(OUTPUTS_DIR, taskId, `${modelPath}.json`);
}

export function findTestCaseForOutput({
  task,
  testCaseId,
}: {
  task: Pick<RegisteredTask, "testCases">;
  testCaseId: string;
}): TestCase | null {
  const baseId = getBaseTestCaseId(testCaseId);
  return task.testCases.find((testCase) => testCase.id === baseId) ?? null;
}

export function combineOutputsWithTestCases({
  modelOutputs,
  task,
}: {
  modelOutputs: ModelOutputs;
  task: Pick<RegisteredTask, "testCases">;
}): TaskModelOutputResults {
  const outputs = modelOutputs.outputs.flatMap((output) => {
    const testCase = findTestCaseForOutput({ task, testCaseId: output.testCaseId });

    if (!testCase) {
      return [];
    }

    return [{ ...output, testCase: { ...testCase, id: output.testCaseId } }];
  });

  return { ...modelOutputs, outputs };
}

async function ensureOutputsDir(taskId: string) {
  const taskDir = path.join(OUTPUTS_DIR, taskId);
  await fs.mkdir(taskDir, { recursive: true });
}

export async function saveModelOutputs(
  taskId: string,
  modelId: string,
  outputs: ModelOutputs,
): Promise<void> {
  await ensureOutputsDir(taskId);
  const filePath = getOutputsFilePath(taskId, modelId);
  await fs.writeFile(filePath, JSON.stringify(outputs, null, 2));
}

export async function deleteModelOutputs({
  modelId,
  taskId,
}: {
  modelId: string;
  taskId: string;
}): Promise<void> {
  await fs.rm(getOutputsFilePath(taskId, modelId), { force: true });
}

export async function removeModelOutputRuns({
  modelId,
  runIds,
  taskId,
}: {
  modelId: string;
  runIds: ReadonlySet<string>;
  taskId: string;
}): Promise<void> {
  const outputs = await loadModelOutputs(taskId, modelId);

  if (!outputs) {
    return;
  }

  await saveModelOutputs(taskId, modelId, {
    ...outputs,
    outputs: outputs.outputs.filter((output) => !runIds.has(output.testCaseId)),
  });
}

export const loadModelOutputs = cache(
  async (taskId: string, modelId: string): Promise<ModelOutputs | null> => {
    const filePath = getOutputsFilePath(taskId, modelId);

    try {
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data) as ModelOutputs;
    } catch {
      return null;
    }
  },
);

type OutputStatus = "complete" | "partial" | "missing";
export type OutputProgress = {
  completedOutputs: number;
  status: OutputStatus;
  totalOutputs: number;
};

export async function getOutputStatus({
  modelId,
  runsPerTestCase,
  task,
}: {
  modelId: string;
  runsPerTestCase: number;
  task: Pick<RegisteredTask, "id" | "testCases">;
}): Promise<OutputProgress> {
  const outputs = await loadModelOutputs(task.id, modelId);

  const { completedRuns: completedOutputs, totalRuns: totalOutputs } = getTestCaseRunProgress({
    completedRunIds: outputs?.outputs.map((output) => output.testCaseId) ?? [],
    runsPerTestCase,
    testCases: task.testCases,
  });

  if (completedOutputs === 0) {
    return { completedOutputs, status: "missing", totalOutputs };
  }

  if (completedOutputs < totalOutputs) {
    return { completedOutputs, status: "partial", totalOutputs };
  }

  return { completedOutputs, status: "complete", totalOutputs };
}

export async function getAllOutputsForTask(taskId: string): Promise<Map<string, ModelOutputs>> {
  const outputsMap = new Map<string, ModelOutputs>();
  const taskDir = path.join(OUTPUTS_DIR, taskId);

  try {
    const files = await fs.readdir(taskDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    const fileContents = await Promise.all(
      jsonFiles.map(async (file) => {
        const filePath = path.join(taskDir, file);
        const data = await fs.readFile(filePath, "utf8");
        return JSON.parse(data) as ModelOutputs;
      }),
    );

    for (const outputs of fileContents) {
      outputsMap.set(outputs.modelId, outputs);
    }
  } catch {
    // A task has no output directory until its first saved run.
  }

  return outputsMap;
}

function getCompleteModelId({
  modelId,
  outputs,
  runsPerTestCase,
  testCases,
}: {
  modelId: string;
  outputs: ModelOutputs;
  runsPerTestCase: number;
  testCases: Pick<TestCase, "id">[];
}): string[] {
  const { completedRuns, totalRuns } = getTestCaseRunProgress({
    completedRunIds: outputs.outputs.map((output) => output.testCaseId),
    runsPerTestCase,
    testCases,
  });

  return totalRuns > 0 && completedRuns === totalRuns ? [modelId] : [];
}

export async function getModelsWithCompleteOutputs({
  runsPerTestCase,
  task,
}: {
  runsPerTestCase: number;
  task: Pick<RegisteredTask, "id" | "testCases">;
}): Promise<string[]> {
  const allOutputs = await getAllOutputsForTask(task.id);

  return [...allOutputs.entries()].flatMap(([modelId, outputs]) =>
    getCompleteModelId({ modelId, outputs, runsPerTestCase, testCases: task.testCases }),
  );
}

export function getOutputForTestCase(
  outputs: ModelOutputs,
  testCaseId: string,
): OutputEntry | null {
  return outputs.outputs.find((output) => output.testCaseId === testCaseId) ?? null;
}
