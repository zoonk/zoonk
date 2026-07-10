import fs from "node:fs/promises";
import path from "node:path";
import { logError, logInfo } from "@zoonk/utils/logger";
import { cache } from "react";
import { findTestCaseForOutput, loadModelOutputs } from "./output-loader";
import { generateScore } from "./score";
import {
  type OutputEntry,
  type RegisteredTask,
  type ScoredResult,
  type ScoredTaskResults,
  type TaskEvalResults,
  type TestCase,
  getJudgeExpectations,
} from "./types";

const EVAL_RESULTS_DIR = path.join(process.cwd(), "eval-results");
const RESULTS_DIR = path.join(EVAL_RESULTS_DIR, "results");

async function ensureResultsDir(taskId: string) {
  const taskDir = path.join(RESULTS_DIR, taskId);
  await fs.mkdir(taskDir, { recursive: true });
}

function getResultsFilePath(taskId: string, modelId: string): string {
  const modelPath = modelId.replaceAll("/", "-");
  return path.join(RESULTS_DIR, taskId, `${modelPath}.json`);
}

async function loadExistingScoredResults(taskId: string, modelId: string): Promise<ScoredResult[]> {
  const filePath = getResultsFilePath(taskId, modelId);

  try {
    const data = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(data) as ScoredTaskResults;
    return parsed.results;
  } catch {
    return [];
  }
}

async function saveScoredResults(taskId: string, modelId: string, results: ScoredResult[]) {
  await ensureResultsDir(taskId);

  const taskResults: ScoredTaskResults = { modelId, results, taskId };

  const filePath = getResultsFilePath(taskId, modelId);
  await fs.writeFile(filePath, JSON.stringify(taskResults, null, 2));
}

async function scoreOutput({
  output,
  task,
  testCase,
}: {
  output: OutputEntry;
  task: RegisteredTask;
  testCase: TestCase;
}): Promise<ScoredResult> {
  logInfo(`Scoring output: ${output.testCaseId}`);

  const scoreResult = task.score
    ? await task.score({ output: output.output, testCase } as never)
    : await generateScore({
        expectations: getJudgeExpectations(testCase),
        output: output.output,
        prompt: output.userPrompt,
      });

  logInfo(`Score: ${scoreResult.score}`);

  const testCaseWithRun: TestCase = { ...testCase, id: output.testCaseId };

  return { steps: scoreResult.steps, testCase: testCaseWithRun };
}

function isAlreadyScored(existingResults: ScoredResult[], testCaseId: string): boolean {
  return existingResults.some((result) => result.testCase.id === testCaseId);
}

export async function runEval(task: RegisteredTask, modelId: string): Promise<TaskEvalResults> {
  const safeModelId = modelId.replaceAll(/[\r\n]/gu, "");

  logInfo(`\nStarting eval for task: ${task.name}, model: [${safeModelId}]`);

  // Load pre-generated outputs
  const modelOutputs = await loadModelOutputs(task.id, modelId);

  if (!modelOutputs || modelOutputs.outputs.length === 0) {
    throw new Error(`No outputs found for model ${modelId}. Generate outputs first.`);
  }

  logInfo(`Found ${modelOutputs.outputs.length} outputs to score`);

  // Load existing scored results
  const existingResults = await loadExistingScoredResults(task.id, modelId);
  logInfo(`Found ${existingResults.length} existing scored results`);

  // Find outputs that haven't been scored yet
  const outputsToScore = modelOutputs.outputs.filter(
    (output) => !isAlreadyScored(existingResults, output.testCaseId),
  );

  logInfo(`Scoring ${outputsToScore.length} outputs`);

  if (outputsToScore.length === 0) {
    logInfo("All outputs already scored");
    return combineOutputsAndResults(task.id, modelId, modelOutputs.outputs, existingResults);
  }

  const results = await Promise.allSettled(
    outputsToScore.map((output) => {
      const testCase = findTestCaseForOutput({ task, testCaseId: output.testCaseId });

      if (!testCase) {
        return Promise.reject(new Error(`Test case not found for output: ${output.testCaseId}`));
      }

      return scoreOutput({ output, task, testCase });
    }),
  );

  const newResults: ScoredResult[] = results.flatMap((result) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }

    logError(
      `Error scoring output: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
    );

    return [];
  });

  const allScoredResults = [...existingResults, ...newResults];

  await saveScoredResults(task.id, modelId, allScoredResults);
  logInfo(`Saved ${allScoredResults.length} total scored results`);

  return combineOutputsAndResults(task.id, modelId, modelOutputs.outputs, allScoredResults);
}

function combineOutputsAndResults(
  taskId: string,
  modelId: string,
  outputs: OutputEntry[],
  scoredResults: ScoredResult[],
): TaskEvalResults {
  const results = scoredResults.flatMap((scored) => {
    const output = outputs.find((entry) => entry.testCaseId === scored.testCase.id);

    if (!output) {
      return [];
    }

    return {
      duration: output.duration,
      inputTokens: output.inputTokens,
      output: output.output,
      outputTokens: output.outputTokens,
      steps: scored.steps,
      testCase: scored.testCase,
    };
  });

  return { modelId, results, taskId };
}

export const getTaskResults = cache(
  async (taskId: string, modelId: string): Promise<TaskEvalResults | null> => {
    const modelOutputs = await loadModelOutputs(taskId, modelId);

    if (!modelOutputs) {
      return null;
    }

    const scoredResults = await loadExistingScoredResults(taskId, modelId);

    if (scoredResults.length === 0) {
      return null;
    }

    const results = scoredResults.flatMap((scored) => {
      const output = modelOutputs.outputs.find((entry) => entry.testCaseId === scored.testCase.id);

      if (!output) {
        return [];
      }

      return {
        duration: output.duration,
        inputTokens: output.inputTokens,
        output: output.output,
        outputTokens: output.outputTokens,
        steps: scored.steps,
        testCase: scored.testCase,
      };
    });

    return { modelId, results, taskId };
  },
);
