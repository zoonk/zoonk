import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { RUNS_PER_TEST_CASE } from "@/tasks";
import { generateScore } from "./score";
import type { EvalResult, Task, TaskEvalResults, TestCase } from "./types";

const RESULTS_DIR = path.join(process.cwd(), "eval-results");

async function ensureResultsDir(taskId: string) {
  const taskDir = path.join(RESULTS_DIR, taskId);
  await fs.mkdir(taskDir, { recursive: true });
}

function getResultsFilePath(taskId: string, modelId: string): string {
  const modelPath = modelId.replace(/\//g, "-");
  return path.join(RESULTS_DIR, taskId, `${modelPath}.json`);
}

async function loadExistingResults(
  taskId: string,
  modelId: string,
): Promise<EvalResult[]> {
  const filePath = getResultsFilePath(taskId, modelId);
  try {
    const data = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(data) as TaskEvalResults;
    return parsed.results;
  } catch {
    return [];
  }
}

async function saveResults(
  taskId: string,
  modelId: string,
  results: EvalResult[],
) {
  await ensureResultsDir(taskId);

  const taskResults: TaskEvalResults = {
    taskId,
    modelId,
    results,
  };

  const filePath = getResultsFilePath(taskId, modelId);
  await fs.writeFile(filePath, JSON.stringify(taskResults, null, 2));
}

async function runTestCase(
  task: Task,
  testCase: TestCase,
  modelId: string,
  runNumber: number,
): Promise<EvalResult> {
  const inputSummary = Object.entries(testCase.userInput)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");

  console.log(`Running test case: ${inputSummary} (run ${runNumber})`);

  const startTime = performance.now();
  const result = await task.generate({
    ...testCase.userInput,
    model: modelId,
  });
  const endTime = performance.now();
  const duration = endTime - startTime;

  const output = JSON.stringify(result.data, null, 2);

  console.log("Generated output for test case, scoring...");

  const scoreResult = await generateScore({
    system: result.systemPrompt,
    prompt: result.userPrompt,
    expectations: testCase.expectations,
    output,
  });

  console.log(`Score: ${scoreResult.score}`);

  // Create a test case with the run number appended to the ID
  const testCaseWithRun: TestCase = {
    ...testCase,
    id: `${testCase.id}-${runNumber}`,
  };

  return {
    testCase: testCaseWithRun,
    output,
    steps: scoreResult.steps,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    duration,
  };
}

function shouldSkipTestCase(
  existing: EvalResult[],
  baseTestCaseId: string,
  runNumber: number,
): boolean {
  // Check if we already have a result for this specific test case run
  const runId = `${baseTestCaseId}-${runNumber}`;
  return existing.some((r) => r.testCase.id === runId);
}

export async function runEval(
  task: Task,
  modelId: string,
): Promise<TaskEvalResults> {
  // Sanitize modelId before logging to prevent log injection
  const safeModelId = String(modelId).replace(/[\r\n]/g, "");
  const totalRuns = task.testCases.length * RUNS_PER_TEST_CASE;

  console.log(
    `\nStarting eval for task: ${task.name}, model: [${safeModelId}]`,
  );

  console.log(
    `Total test cases: ${task.testCases.length} (${totalRuns} runs with ${RUNS_PER_TEST_CASE} iterations each)`,
  );

  const existingResults = await loadExistingResults(task.id, modelId);
  console.log(`Found ${existingResults.length} existing results`);

  // Generate all test case runs that need to be executed
  const testCaseRunsToExecute: Array<{
    testCase: TestCase;
    runNumber: number;
  }> = [];

  for (const testCase of task.testCases) {
    for (let runNumber = 1; runNumber <= RUNS_PER_TEST_CASE; runNumber++) {
      if (!shouldSkipTestCase(existingResults, testCase.id, runNumber)) {
        testCaseRunsToExecute.push({ testCase, runNumber });
      }
    }
  }

  console.log(`Running ${testCaseRunsToExecute.length} new test case runs`);

  if (testCaseRunsToExecute.length === 0) {
    console.log("All test cases already completed, loading existing results");
    const filePath = getResultsFilePath(task.id, modelId);
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as TaskEvalResults;
  }

  const results = await Promise.allSettled(
    testCaseRunsToExecute.map(({ testCase, runNumber }) =>
      runTestCase(task, testCase, modelId, runNumber),
    ),
  );

  // Filter out the rejected promises and extract values from fulfilled ones
  const newResults: EvalResult[] = results
    .map((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      }

      console.error(
        `Error running test case: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
      );

      return null;
    })
    .filter((res): res is EvalResult => res !== null);

  const allResults = [...existingResults, ...newResults];

  await saveResults(task.id, modelId, allResults);
  console.log(`Saved ${allResults.length} total results`);

  const filePath = getResultsFilePath(task.id, modelId);
  const data = await fs.readFile(filePath, "utf-8");
  return JSON.parse(data) as TaskEvalResults;
}

export const getTaskResults = cache(
  async (taskId: string, modelId: string): Promise<TaskEvalResults | null> => {
    const filePath = getResultsFilePath(taskId, modelId);
    try {
      const data = await fs.readFile(filePath, "utf-8");
      return JSON.parse(data) as TaskEvalResults;
    } catch {
      return null;
    }
  },
);
