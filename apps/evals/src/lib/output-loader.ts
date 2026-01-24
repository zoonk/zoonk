import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { type ModelOutputs, type OutputEntry } from "./types";

const EVAL_RESULTS_DIR = path.join(process.cwd(), "eval-results");
const OUTPUTS_DIR = path.join(EVAL_RESULTS_DIR, "outputs");

function getOutputsFilePath(taskId: string, modelId: string): string {
  const modelPath = modelId.replace(/\//g, "-");
  return path.join(OUTPUTS_DIR, taskId, `${modelPath}.json`);
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

export type OutputStatus = "complete" | "partial" | "missing";

export async function getOutputStatus(
  taskId: string,
  modelId: string,
  totalTestCases: number,
): Promise<{
  status: OutputStatus;
  completedTestCases: number;
  totalTestCases: number;
}> {
  const outputs = await loadModelOutputs(taskId, modelId);
  const completedTestCases = outputs?.outputs.length ?? 0;

  if (completedTestCases === 0) {
    return { completedTestCases, status: "missing", totalTestCases };
  }

  if (completedTestCases < totalTestCases) {
    return { completedTestCases, status: "partial", totalTestCases };
  }

  return { completedTestCases, status: "complete", totalTestCases };
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
    // Directory doesn't exist or is empty
  }

  return outputsMap;
}

export async function getModelsWithCompleteOutputs(
  taskId: string,
  totalTestCases: number,
): Promise<string[]> {
  const allOutputs = await getAllOutputsForTask(taskId);
  const completeModels: string[] = [];

  for (const [modelId, outputs] of allOutputs) {
    if (outputs.outputs.length >= totalTestCases) {
      completeModels.push(modelId);
    }
  }

  return completeModels;
}

export function getOutputForTestCase(
  outputs: ModelOutputs,
  testCaseId: string,
): OutputEntry | undefined {
  return outputs.outputs.find((output) => output.testCaseId === testCaseId);
}
