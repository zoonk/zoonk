import { RUNS_PER_TEST_CASE } from "@/tasks";
import { logError, logInfo } from "@zoonk/utils/logger";
import { settleWithConcurrency } from "./concurrency";
import { type ModelConfig, getModelById } from "./models";
import { loadModelOutputs, saveModelOutputs } from "./output-loader";
import { getTestCaseRunId } from "./test-case-runs";
import {
  type ModelOutputs,
  type OutputEntry,
  type RegisteredTask,
  type TestCase,
  toTokenUsage,
} from "./types";

/**
 * Few enough calls in flight that one run doesn't queue behind itself at the
 * provider, so p50 and p95 measure the model instead of our own burst.
 */
const GENERATION_CONCURRENCY = 4;

/**
 * Evaluation models answer through the task's `evaluate` route; everything else
 * runs the task's own prompt. Tasks without an evaluation route can't be run
 * with an evaluation model, so that mismatch fails before any call.
 */
function getTaskRunner({ model, task }: { model: ModelConfig; task: RegisteredTask }) {
  if (model.kind !== "evaluation") {
    return task.generate;
  }

  if (!task.evaluate) {
    throw new Error(`Task ${task.id} has no evaluation route for ${model.id}.`);
  }

  return task.evaluate;
}

/**
 * The eval registry intentionally erases each task's concrete input type so it
 * can list heterogeneous tasks together. This builds the runtime input from
 * the paired test case; the runner call casts it back at the boundary.
 */
function getTaskRunInput({ model, testCase }: { model: ModelConfig; testCase: TestCase }) {
  return {
    ...testCase.userInput,
    model: model.gatewayModelId,
    reasoning: model.reasoning,
    useFallback: false,
  };
}

/**
 * Runs one model output for one registry test case. The cast is contained here
 * because registry tasks are intentionally type-erased, while each task module
 * still keeps its concrete input type.
 */
async function generateOutputForTestCase({
  model,
  runNumber,
  task,
  testCase,
}: {
  model: ModelConfig;
  runNumber: number;
  task: RegisteredTask;
  testCase: TestCase;
}): Promise<OutputEntry> {
  logInfo(`Generating output for: ${testCase.id} (run ${runNumber})`);

  const runTask = getTaskRunner({ model, task });
  const input = getTaskRunInput({ model, testCase });
  const startTime = performance.now();
  const result = await runTask(input as never);
  const duration = performance.now() - startTime;

  return {
    ...toTokenUsage(result.usage),
    duration,
    output: JSON.stringify(result.data, null, 2),
    probabilities: result.probabilities,
    systemPrompt: result.systemPrompt,
    testCaseId: getTestCaseRunId({ runNumber, testCaseId: testCase.id }),
    userPrompt: result.userPrompt,
  };
}

function shouldSkipTestCase(
  existingOutputs: OutputEntry[],
  baseTestCaseId: string,
  runNumber: number,
): boolean {
  const runId = getTestCaseRunId({ runNumber, testCaseId: baseTestCaseId });
  return existingOutputs.some((output) => output.testCaseId === runId);
}

type TestCaseRun = { testCase: TestCase; runNumber: number };

function collectTestCaseRuns(testCases: TestCase[], existingEntries: OutputEntry[]): TestCaseRun[] {
  const runs: TestCaseRun[] = [];

  for (const testCase of testCases) {
    for (let runNumber = 1; runNumber <= RUNS_PER_TEST_CASE; runNumber += 1) {
      if (!shouldSkipTestCase(existingEntries, testCase.id, runNumber)) {
        runs.push({ runNumber, testCase });
      }
    }
  }

  return runs;
}

function extractSuccessfulOutputs(results: PromiseSettledResult<OutputEntry>[]): OutputEntry[] {
  return results.flatMap((result) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }

    logError(
      `Error generating output: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
    );

    return [];
  });
}

function createModelOutputs(taskId: string, modelId: string, outputs: OutputEntry[]): ModelOutputs {
  return { generatedAt: new Date().toISOString(), modelId, outputs, taskId };
}

export async function generateOutputs(
  task: RegisteredTask,
  modelId: string,
): Promise<ModelOutputs> {
  const safeModelId = modelId.replaceAll(/[\r\n]/gu, "");
  const model = getModelById(modelId);

  if (!model) {
    throw new Error(`Model ${safeModelId} not found`);
  }

  logInfo(`\nGenerating outputs for task: ${task.name}, model: [${safeModelId}]`);

  logInfo(
    `Total test cases: ${task.testCases.length} (${task.testCases.length * RUNS_PER_TEST_CASE} runs)`,
  );

  const existingOutputs = await loadModelOutputs(task.id, modelId);
  const existingEntries = existingOutputs?.outputs ?? [];
  logInfo(`Found ${existingEntries.length} existing outputs`);

  const runsToExecute = collectTestCaseRuns(task.testCases, existingEntries);
  logInfo(`Generating ${runsToExecute.length} new outputs`);

  if (runsToExecute.length === 0) {
    logInfo("All outputs already generated");
    return existingOutputs ?? createModelOutputs(task.id, modelId, []);
  }

  const results = await settleWithConcurrency({
    concurrency: GENERATION_CONCURRENCY,
    items: runsToExecute,
    run: ({ testCase, runNumber }) =>
      generateOutputForTestCase({ model, runNumber, task, testCase }),
  });

  const allOutputs = [...existingEntries, ...extractSuccessfulOutputs(results)];
  const modelOutputs = createModelOutputs(task.id, modelId, allOutputs);

  await saveModelOutputs(task.id, modelId, modelOutputs);
  logInfo(`Saved ${allOutputs.length} total outputs`);

  return modelOutputs;
}
