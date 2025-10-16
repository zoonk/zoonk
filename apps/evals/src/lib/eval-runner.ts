import fs from "node:fs/promises";
import path from "node:path";
import { generateScore } from "./score";
import type { EvalResult, Task, TaskEvalResults, TestCase } from "./types";

const RESULTS_DIR = path.join(process.cwd(), "eval-results");

async function ensureResultsDir() {
  await fs.mkdir(RESULTS_DIR, { recursive: true });
}

function getResultsFilePath(taskId: string, modelId: string): string {
  return path.join(
    RESULTS_DIR,
    `${taskId}-${modelId.replace(/\//g, "-")}.json`,
  );
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
  await ensureResultsDir();

  const taskResults: TaskEvalResults = {
    taskId,
    modelId,
    results,
  };

  const filePath = getResultsFilePath(taskId, modelId);
  await fs.writeFile(filePath, JSON.stringify(taskResults, null, 2));
}

async function runTestCase<TInput = unknown, TOutput = unknown>(
  task: Task<TInput, TOutput>,
  testCase: TestCase,
  modelId: string,
): Promise<EvalResult> {
  const inputSummary = Object.entries(testCase.userInput)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");

  console.log(`Running test case: ${inputSummary}`);

  const result = await task.generate({
    ...testCase.userInput,
    model: modelId,
  } as TInput & { model: string });

  const output = JSON.stringify(result.data, null, 2);

  console.log("Generated output for test case, scoring...");

  const scoreResult = await generateScore({
    system: result.systemPrompt,
    prompt: result.userPrompt,
    expectations: testCase.expectations,
    output,
  });

  console.log(`Score: ${scoreResult.score}`);

  return {
    testCase,
    output,
    score: scoreResult.score,
    steps: scoreResult.steps,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
  };
}
function shouldSkipTestCase(
  existing: EvalResult[],
  testCase: TestCase,
): boolean {
  // Check if we already have a result for this test case ID
  return existing.some((r) => r.testCase.id === testCase.id);
}

export async function runEval<TInput = unknown, TOutput = unknown>(
  task: Task<TInput, TOutput>,
  modelId: string,
): Promise<TaskEvalResults> {
  // Sanitize modelId before logging to prevent log injection
  const safeModelId = String(modelId).replace(/[\r\n]/g, "");
  console.log(
    `\nStarting eval for task: ${task.name}, model: [${safeModelId}]`,
  );
  console.log(`Total test cases: ${task.testCases.length}`);

  const existingResults = await loadExistingResults(task.id, modelId);
  console.log(`Found ${existingResults.length} existing results`);

  const testCasesToRun = task.testCases.filter(
    (tc) => !shouldSkipTestCase(existingResults, tc),
  );
  console.log(`Running ${testCasesToRun.length} new test cases`);

  if (testCasesToRun.length === 0) {
    console.log("All test cases already completed, loading existing results");
    const filePath = getResultsFilePath(task.id, modelId);
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as TaskEvalResults;
  }

  const newResults = await Promise.all(
    testCasesToRun.map((tc) => runTestCase(task, tc, modelId)),
  );

  const allResults = [...existingResults, ...newResults];

  await saveResults(task.id, modelId, allResults);
  console.log(`Saved ${allResults.length} total results`);

  const filePath = getResultsFilePath(task.id, modelId);
  const data = await fs.readFile(filePath, "utf-8");
  return JSON.parse(data) as TaskEvalResults;
}

export async function getTaskResults(
  taskId: string,
  modelId: string,
): Promise<TaskEvalResults | null> {
  const filePath = getResultsFilePath(taskId, modelId);
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as TaskEvalResults;
  } catch {
    return null;
  }
}
