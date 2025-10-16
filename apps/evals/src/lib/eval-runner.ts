import fs from "node:fs/promises";
import path from "node:path";
import { getModelById } from "./models";
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

  const model = getModelById(modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }

  const averageScore =
    results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const averageInputTokens =
    results.reduce((sum, r) => sum + r.inputTokens, 0) / results.length;
  const averageOutputTokens =
    results.reduce((sum, r) => sum + r.outputTokens, 0) / results.length;

  const TOKENS_PER_MILLION = 1_000_000;
  const COST_MULTIPLIER = 100;

  // Calculate cost for 100 runs
  const costPer100Runs =
    ((averageInputTokens * model.inputCost) / TOKENS_PER_MILLION +
      (averageOutputTokens * model.outputCost) / TOKENS_PER_MILLION) *
    COST_MULTIPLIER;

  const taskResults: TaskEvalResults = {
    taskId,
    modelId,
    results,
    averageScore,
    averageInputTokens,
    averageOutputTokens,
    totalCost: costPer100Runs,
  };

  const filePath = getResultsFilePath(taskId, modelId);
  await fs.writeFile(filePath, JSON.stringify(taskResults, null, 2));
}

async function runTestCase(
  task: Task,
  testCase: TestCase,
  modelId: string,
): Promise<EvalResult> {
  console.log(
    `Running test case: locale=${testCase.locale}, prompt="${testCase.prompt}"`,
  );

  // biome-ignore lint/suspicious/noExplicitAny: testCase contains task-specific params
  const result = await (task.generate as any)({
    locale: testCase.locale,
    prompt: testCase.prompt,
    model: modelId,
  });
  const output = task.formatOutput(result.data);

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
  return existing.some(
    (r) =>
      r.testCase.locale === testCase.locale &&
      r.testCase.prompt === testCase.prompt,
  );
}

export async function runEval(
  task: Task,
  modelId: string,
): Promise<TaskEvalResults> {
  console.log(`\nStarting eval for task: ${task.name}, model: ${modelId}`);
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
