import { RUNS_PER_TEST_CASE } from "@/tasks";
import { GatewayError } from "@ai-sdk/gateway";
import { type BilledCall, meterBilledCalls } from "@zoonk/ai/billed-calls";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import { logError, logInfo } from "@zoonk/utils/logger";
import { APICallError, NoObjectGeneratedError, RetryError } from "ai";
import { generationSourceHash } from "./comparisons/generation-source";
import { hash, hashJson } from "./comparisons/identity";
import { settleWithConcurrency } from "./concurrency";
import { getFailedRunsCost } from "./cost";
import { getImageRunsToReplace } from "./eval-runner";
import { DEFAULT_REASONING, type ModelConfig, getModelById } from "./models";
import { loadModelOutputs, saveModelOutputs, withImageGeneration } from "./output-loader";
import { getTestCaseRunId } from "./test-case-runs";
import {
  type FailedRun,
  type FailureReason,
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
    reasoning: model.reasoning ?? DEFAULT_REASONING,
    useFallback: false,
  };
}

type FailedAttempt = {
  billed: BilledCall[];
  testCaseId: string;
  reason: FailureReason;
  message: string;
};

function getFailureReason(error: unknown): FailureReason {
  if (RetryError.isInstance(error)) {
    return getFailureReason(error.lastError);
  }

  if (NoObjectGeneratedError.isInstance(error)) {
    return "schema";
  }

  return APICallError.isInstance(error) || GatewayError.isInstance(error) ? "provider" : "other";
}

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
  sourceHash,
  task,
  testCase,
}: {
  failed: FailedAttempt[];
  model: ModelConfig;
  runNumber: number;
  sourceHash: string;
  task: RegisteredTask;
  testCase: TestCase;
}) {
  logInfo(`Generating output for: ${testCase.id} (run ${runNumber})`);

  const testCaseId = getTestCaseRunId({ runNumber, testCaseId: testCase.id });
  const runTask = getTaskRunner({ model, task });
  const input = { ...getTaskRunInput({ model, testCase }), runId: testCaseId };
  const billed: BilledCall[] = [];
  const startTime = performance.now();

  const result = await meterBilledCalls(billed, () => runTask(input as never)).catch(
    (error: unknown) => {
      failed.push({
        billed,
        message: (error instanceof Error ? error.message : String(error))
          .replaceAll(/\s+/gu, " ")
          .slice(0, 300),
        reason: getFailureReason(error),
        testCaseId,
      });

      throw error;
    },
  );

  const duration = performance.now() - startTime;

  return {
    ...toTokenUsage(result.usage),
    ...toRunCalls(billed),
    caseInputHash: hashJson(testCase.userInput),
    duration,
    generation: { model: input.model, reasoning: input.reasoning, sourceHash },
    initialPromptHashes: result.initialPrompt
      ? {
          system: hash(result.initialPrompt.systemPrompt),
          user: hash(result.initialPrompt.userPrompt),
        }
      : undefined,
    output: JSON.stringify(result.data, null, 2),
    probabilities: result.probabilities,
    systemPrompt: result.systemPrompt,
    testCaseId,
    userPrompt: result.userPrompt,
  };
}

type TestCaseRun = { testCase: TestCase; runNumber: number; replacing: boolean };

function collectTestCaseRuns({
  existingEntries,
  replaceRuns,
  runsPerTestCase,
  testCases,
}: {
  existingEntries: OutputEntry[];
  replaceRuns: ReadonlySet<string>;
  runsPerTestCase: number;
  testCases: TestCase[];
}): TestCaseRun[] {
  const runs: TestCaseRun[] = [];
  const savedIds = new Set(existingEntries.map((entry) => entry.testCaseId));

  for (const testCase of testCases) {
    for (let runNumber = 1; runNumber <= runsPerTestCase; runNumber += 1) {
      const runId = getTestCaseRunId({ runNumber, testCaseId: testCase.id });
      const replacing = replaceRuns.has(runId);

      if (!savedIds.has(runId) || replacing) {
        runs.push({ replacing, runNumber, testCase });
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
  failed,
  failedRuns = [],
  modelId,
  outputs,
  taskId,
}: {
  failed: FailedAttempt[];
  failedRuns?: FailedRun[];
  modelId: string;
  outputs: OutputEntry[];
  taskId: string;
}): ModelOutputs {
  const allFailedRuns = [
    ...failedRuns,
    ...failed.map(({ billed, message, reason, testCaseId }) => ({
      ...toRunCalls(billed),
      message,
      reason,
      testCaseId,
    })),
  ];

  return {
    failedRuns: allFailedRuns.length > 0 ? allFailedRuns : undefined,
    generatedAt: new Date().toISOString(),
    modelId,
    outputs,
    taskId,
  };
}

/** Returns the outputs it wrote, leaving out saved ones and failed runs. */
export async function generateOutputs(
  task: RegisteredTask,
  modelId: string,
  { runsPerTestCase = RUNS_PER_TEST_CASE }: { runsPerTestCase?: number } = {},
): Promise<OutputEntry[]> {
  const safeModelId = modelId.replaceAll(/[\r\n]/gu, "");
  const model = getModelById(modelId);

  if (!model) {
    throw new Error(`Model ${safeModelId} not found`);
  }

  const generate = () => generateModelOutputs({ model, runsPerTestCase, safeModelId, task });

  return task.output === "image" ? withImageGeneration(task.id, modelId, generate) : generate();
}

async function generateModelOutputs({
  model,
  runsPerTestCase,
  safeModelId,
  task,
}: {
  model: ModelConfig;
  runsPerTestCase: number;
  safeModelId: string;
  task: RegisteredTask;
}) {
  const modelId = model.id;
  logInfo(`\nGenerating outputs for task: ${task.name}, model: [${safeModelId}]`);

  logInfo(
    `Total test cases: ${task.testCases.length} (${task.testCases.length * runsPerTestCase} runs)`,
  );

  const existingOutputs = await loadModelOutputs(task.id, modelId);
  const existingEntries = existingOutputs?.outputs ?? [];

  const replaceRuns =
    task.output === "image" && existingOutputs
      ? await getImageRunsToReplace(existingOutputs)
      : new Set<string>();

  logInfo(`Found ${existingEntries.length} existing outputs`);

  const runsToExecute = collectTestCaseRuns({
    existingEntries,
    replaceRuns,
    runsPerTestCase,
    testCases: task.testCases,
  });

  const replacing = runsToExecute.filter((run) => run.replacing).length;

  if (replacing > 0) {
    logInfo(`Replacing ${replacing} images without a score`);
  }

  logInfo(`Generating ${runsToExecute.length} new outputs`);

  if (runsToExecute.length === 0) {
    logInfo("All outputs already generated");
    return [];
  }

  const failed: FailedAttempt[] = [];
  const sourceHash = generationSourceHash();

  const results = await settleWithConcurrency({
    concurrency: GENERATION_CONCURRENCY,
    items: runsToExecute,
    run: ({ testCase, runNumber }) =>
      generateOutputForTestCase({ failed, model, runNumber, sourceHash, task, testCase }),
  });

  const newOutputs = extractSuccessfulOutputs(results);
  const writtenRuns = new Set(newOutputs.map((entry) => entry.testCaseId));

  const allOutputs = [
    ...existingEntries.filter((entry) => !writtenRuns.has(entry.testCaseId)),
    ...newOutputs,
  ];

  await saveModelOutputs(
    task.id,
    modelId,
    createModelOutputs({
      failed,
      failedRuns: existingOutputs?.failedRuns,
      modelId,
      outputs: allOutputs,
      taskId: task.id,
    }),
  );

  logInfo(`Saved ${allOutputs.length} total outputs`);

  return newOutputs;
}

export async function generateComparisonRun(args: {
  model: ModelConfig;
  runNumber: number;
  sourceHash: string;
  task: RegisteredTask;
  testCase: TestCase;
}) {
  const failed: FailedAttempt[] = [];

  try {
    return { output: await generateOutputForTestCase({ ...args, failed }) } as const;
  } catch (error) {
    const attempt = failed[0];

    if (!attempt) {
      throw error;
    }

    return {
      costUsd: getFailedRunsCost({
        failedRuns: [{ testCaseId: attempt.testCaseId, ...toRunCalls(attempt.billed) }],
        prices: GATEWAY_PRICES,
      }),
      output: null,
      reason: attempt.reason,
    } as const;
  }
}
