import { RUNS_PER_TEST_CASE } from "@/tasks";
import { type BilledCall, meterBilledCalls } from "@zoonk/ai/billed-calls";
import { logError, logInfo } from "@zoonk/utils/logger";
import { settleWithConcurrency } from "./concurrency";
import { type ModelConfig, getModelById } from "./models";
import { loadModelOutputs, saveModelOutputs } from "./output-loader";
import { getTestCaseRunId } from "./test-case-runs";
import {
  type FailedRun,
  type ModelOutputs,
  type OutputEntry,
  type RegisteredTask,
  type TestCase,
  toModelCall,
  toTokenUsage,
} from "./types";

/**
 * Few enough calls in flight that one run doesn't queue behind itself at the
 * provider, so p50 and p95 measure the model instead of our own burst.
 */
const GENERATION_CONCURRENCY = 4;

function getTaskRunner({ model, task }: { model: ModelConfig; task: RegisteredTask }) {
  if (model.kind !== "evaluation") {
    return task.generate;
  }

  if (!task.evaluate) {
    throw new Error(`Task ${task.id} has no evaluation route for ${model.id}.`);
  }

  return task.evaluate;
}

function getTaskRunInput({ model, testCase }: { model: ModelConfig; testCase: TestCase }) {
  return {
    ...testCase.userInput,
    model: model.gatewayModelId,
    reasoning: model.reasoning,
    useFallback: false,
  };
}

type FailedAttempt = { billed: BilledCall[]; testCaseId: string };

function toRunCalls(billed: readonly BilledCall[]): Pick<OutputEntry, "calls" | "extraCalls"> {
  const extraCalls = billed.filter((call) => call.extra).map((call) => toModelCall(call));

  return {
    calls: billed.filter((call) => !call.extra).map((call) => toModelCall(call)),
    extraCalls: extraCalls.length > 0 ? extraCalls : undefined,
  };
}

/**
 * A failed run keeps its meter, read when the outputs are saved, so a call it started that ends
 * after it failed still counts if it ends before the save.
 */
async function generateOutputForTestCase({
  failed,
  model,
  runNumber,
  task,
  testCase,
}: {
  failed: FailedAttempt[];
  model: ModelConfig;
  runNumber: number;
  task: RegisteredTask;
  testCase: TestCase;
}): Promise<OutputEntry> {
  logInfo(`Generating output for: ${testCase.id} (run ${runNumber})`);

  const testCaseId = getTestCaseRunId({ runNumber, testCaseId: testCase.id });
  const runTask = getTaskRunner({ model, task });
  const input = getTaskRunInput({ model, testCase });
  const billed: BilledCall[] = [];
  const startTime = performance.now();

  const result = await meterBilledCalls(billed, () => runTask(input as never)).catch(
    (error: unknown) => {
      failed.push({ billed, testCaseId });
      throw error;
    },
  );

  const duration = performance.now() - startTime;

  return {
    ...toTokenUsage(result.usage),
    ...toRunCalls(billed),
    duration,
    output: JSON.stringify(result.data, null, 2),
    probabilities: result.probabilities,
    systemPrompt: result.systemPrompt,
    testCaseId,
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

function collectTestCaseRuns({
  existingEntries,
  runsPerTestCase,
  testCases,
}: {
  existingEntries: OutputEntry[];
  runsPerTestCase: number;
  testCases: TestCase[];
}): TestCaseRun[] {
  const runs: TestCaseRun[] = [];

  for (const testCase of testCases) {
    for (let runNumber = 1; runNumber <= runsPerTestCase; runNumber += 1) {
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

function createModelOutputs({
  failed = [],
  failedRuns = [],
  modelId,
  outputs,
  taskId,
}: {
  failed?: FailedAttempt[];
  failedRuns?: FailedRun[];
  modelId: string;
  outputs: OutputEntry[];
  taskId: string;
}): ModelOutputs {
  const allFailedRuns = [
    ...failedRuns,
    ...failed
      .filter(({ billed }) => billed.length > 0)
      .map(({ billed, testCaseId }) => ({ ...toRunCalls(billed), testCaseId })),
  ];

  return {
    failedRuns: allFailedRuns.length > 0 ? allFailedRuns : undefined,
    generatedAt: new Date().toISOString(),
    modelId,
    outputs,
    taskId,
  };
}

export async function generateOutputs(
  task: RegisteredTask,
  modelId: string,
  { runsPerTestCase = RUNS_PER_TEST_CASE }: { runsPerTestCase?: number } = {},
): Promise<ModelOutputs> {
  const safeModelId = modelId.replaceAll(/[\r\n]/gu, "");
  const model = getModelById(modelId);

  if (!model) {
    throw new Error(`Model ${safeModelId} not found`);
  }

  logInfo(`\nGenerating outputs for task: ${task.name}, model: [${safeModelId}]`);

  logInfo(
    `Total test cases: ${task.testCases.length} (${task.testCases.length * runsPerTestCase} runs)`,
  );

  const existingOutputs = await loadModelOutputs(task.id, modelId);
  const existingEntries = existingOutputs?.outputs ?? [];
  logInfo(`Found ${existingEntries.length} existing outputs`);

  const runsToExecute = collectTestCaseRuns({
    existingEntries,
    runsPerTestCase,
    testCases: task.testCases,
  });

  logInfo(`Generating ${runsToExecute.length} new outputs`);

  if (runsToExecute.length === 0) {
    logInfo("All outputs already generated");
    return existingOutputs ?? createModelOutputs({ modelId, outputs: [], taskId: task.id });
  }

  const failed: FailedAttempt[] = [];

  const results = await settleWithConcurrency({
    concurrency: GENERATION_CONCURRENCY,
    items: runsToExecute,
    run: ({ testCase, runNumber }) =>
      generateOutputForTestCase({ failed, model, runNumber, task, testCase }),
  });

  const allOutputs = [...existingEntries, ...extractSuccessfulOutputs(results)];

  const modelOutputs = createModelOutputs({
    failed,
    failedRuns: existingOutputs?.failedRuns,
    modelId,
    outputs: allOutputs,
    taskId: task.id,
  });

  await saveModelOutputs(task.id, modelId, modelOutputs);
  logInfo(`Saved ${allOutputs.length} total outputs`);

  return modelOutputs;
}
