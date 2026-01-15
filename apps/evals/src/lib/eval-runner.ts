import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { loadModelOutputs } from "./output-loader";
import { generateScore } from "./score";
import type {
  EvalResult,
  OutputEntry,
  ScoredResult,
  ScoredTaskResults,
  Task,
  TaskEvalResults,
  TestCase,
} from "./types";

const EVAL_RESULTS_DIR = path.join(process.cwd(), "eval-results");
const RESULTS_DIR = path.join(EVAL_RESULTS_DIR, "results");

async function ensureResultsDir(taskId: string) {
  const taskDir = path.join(RESULTS_DIR, taskId);
  await fs.mkdir(taskDir, { recursive: true });
}

function getResultsFilePath(taskId: string, modelId: string): string {
  const modelPath = modelId.replace(/\//g, "-");
  return path.join(RESULTS_DIR, taskId, `${modelPath}.json`);
}

async function loadExistingScoredResults(
  taskId: string,
  modelId: string,
): Promise<ScoredResult[]> {
  const filePath = getResultsFilePath(taskId, modelId);
  try {
    const data = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(data) as ScoredTaskResults;
    return parsed.results;
  } catch {
    return [];
  }
}

async function saveScoredResults(
  taskId: string,
  modelId: string,
  results: ScoredResult[],
) {
  await ensureResultsDir(taskId);

  const taskResults: ScoredTaskResults = {
    modelId,
    results,
    taskId,
  };

  const filePath = getResultsFilePath(taskId, modelId);
  await fs.writeFile(filePath, JSON.stringify(taskResults, null, 2));
}

function findTestCaseForOutput(
  task: Task,
  testCaseId: string,
): TestCase | undefined {
  // testCaseId format is "{baseId}-{runNumber}"
  const lastDashIndex = testCaseId.lastIndexOf("-");
  const baseId = testCaseId.substring(0, lastDashIndex);
  return task.testCases.find((tc) => tc.id === baseId);
}

async function scoreOutput(
  output: OutputEntry,
  testCase: TestCase,
): Promise<ScoredResult> {
  console.info(`Scoring output: ${output.testCaseId}`);

  const scoreResult = await generateScore({
    expectations: testCase.expectations,
    output: output.output,
    prompt: output.userPrompt,
    system: output.systemPrompt,
  });

  console.info(`Score: ${scoreResult.score}`);

  const testCaseWithRun: TestCase = {
    ...testCase,
    id: output.testCaseId,
  };

  return {
    steps: scoreResult.steps,
    testCase: testCaseWithRun,
  };
}

function isAlreadyScored(
  existingResults: ScoredResult[],
  testCaseId: string,
): boolean {
  return existingResults.some((r) => r.testCase.id === testCaseId);
}

export async function runEval(
  task: Task,
  modelId: string,
): Promise<TaskEvalResults> {
  const safeModelId = String(modelId).replace(/[\r\n]/g, "");

  console.info(
    `\nStarting eval for task: ${task.name}, model: [${safeModelId}]`,
  );

  // Load pre-generated outputs
  const modelOutputs = await loadModelOutputs(task.id, modelId);
  if (!modelOutputs || modelOutputs.outputs.length === 0) {
    throw new Error(
      `No outputs found for model ${modelId}. Generate outputs first.`,
    );
  }

  console.info(`Found ${modelOutputs.outputs.length} outputs to score`);

  // Load existing scored results
  const existingResults = await loadExistingScoredResults(task.id, modelId);
  console.info(`Found ${existingResults.length} existing scored results`);

  // Find outputs that haven't been scored yet
  const outputsToScore = modelOutputs.outputs.filter(
    (output) => !isAlreadyScored(existingResults, output.testCaseId),
  );

  console.info(`Scoring ${outputsToScore.length} outputs`);

  if (outputsToScore.length === 0) {
    console.info("All outputs already scored");
    return combineOutputsAndResults(
      task.id,
      modelId,
      modelOutputs.outputs,
      existingResults,
    );
  }

  const results = await Promise.allSettled(
    outputsToScore.map((output) => {
      const testCase = findTestCaseForOutput(task, output.testCaseId);
      if (!testCase) {
        return Promise.reject(
          new Error(`Test case not found for output: ${output.testCaseId}`),
        );
      }
      return scoreOutput(output, testCase);
    }),
  );

  const newResults: ScoredResult[] = results
    .map((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      console.error(
        `Error scoring output: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
      );
      return null;
    })
    .filter((res): res is ScoredResult => res !== null);

  const allScoredResults = [...existingResults, ...newResults];

  await saveScoredResults(task.id, modelId, allScoredResults);
  console.info(`Saved ${allScoredResults.length} total scored results`);

  return combineOutputsAndResults(
    task.id,
    modelId,
    modelOutputs.outputs,
    allScoredResults,
  );
}

function combineOutputsAndResults(
  taskId: string,
  modelId: string,
  outputs: OutputEntry[],
  scoredResults: ScoredResult[],
): TaskEvalResults {
  const results: EvalResult[] = [];

  for (const scored of scoredResults) {
    const output = outputs.find((o) => o.testCaseId === scored.testCase.id);
    if (!output) {
      continue;
    }

    results.push({
      duration: output.duration,
      inputTokens: output.inputTokens,
      output: output.output,
      outputTokens: output.outputTokens,
      steps: scored.steps,
      testCase: scored.testCase,
    });
  }

  return {
    modelId,
    results,
    taskId,
  };
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

    const results: EvalResult[] = [];

    for (const scored of scoredResults) {
      const output = modelOutputs.outputs.find(
        (o) => o.testCaseId === scored.testCase.id,
      );
      if (!output) {
        continue;
      }

      results.push({
        duration: output.duration,
        inputTokens: output.inputTokens,
        output: output.output,
        outputTokens: output.outputTokens,
        steps: scored.steps,
        testCase: scored.testCase,
      });
    }

    return {
      modelId,
      results,
      taskId,
    };
  },
);
