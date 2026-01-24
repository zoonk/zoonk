import { RUNS_PER_TEST_CASE } from "@/tasks";
import { getGatewayModelId, getModelById } from "./models";
import { loadModelOutputs, saveModelOutputs } from "./output-loader";
import { type ModelOutputs, type OutputEntry, type Task, type TestCase } from "./types";

async function generateOutputForTestCase(
  task: Task,
  testCase: TestCase,
  modelId: string,
  runNumber: number,
): Promise<OutputEntry> {
  const inputSummary = Object.entries(testCase.userInput)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ");

  console.info(`Generating output for: ${inputSummary} (run ${runNumber})`);

  const model = getModelById(modelId);
  const gatewayModelId = getGatewayModelId(modelId);
  const startTime = performance.now();
  const result = await task.generate({
    ...testCase.userInput,
    model: gatewayModelId,
    reasoningEffort: model?.reasoningEffort,
    useFallback: false,
  });
  const duration = performance.now() - startTime;

  const testCaseId = `${testCase.id}-${runNumber}`;

  return {
    duration,
    inputTokens: result.usage.inputTokens ?? 0,
    output: JSON.stringify(result.data, null, 2),
    outputTokens: result.usage.outputTokens ?? 0,
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
  const runId = `${baseTestCaseId}-${runNumber}`;
  return existingOutputs.some((output) => output.testCaseId === runId);
}

type TestCaseRun = { testCase: TestCase; runNumber: number };

function collectTestCaseRuns(testCases: TestCase[], existingEntries: OutputEntry[]): TestCaseRun[] {
  const runs: TestCaseRun[] = [];
  for (const testCase of testCases) {
    for (let runNumber = 1; runNumber <= RUNS_PER_TEST_CASE; runNumber++) {
      if (!shouldSkipTestCase(existingEntries, testCase.id, runNumber)) {
        runs.push({ runNumber, testCase });
      }
    }
  }
  return runs;
}

function extractSuccessfulOutputs(results: PromiseSettledResult<OutputEntry>[]): OutputEntry[] {
  return results
    .map((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      console.error(
        `Error generating output: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
      );
      return null;
    })
    .filter((res): res is OutputEntry => res !== null);
}

function createModelOutputs(taskId: string, modelId: string, outputs: OutputEntry[]): ModelOutputs {
  return { generatedAt: new Date().toISOString(), modelId, outputs, taskId };
}

export async function generateOutputs(task: Task, modelId: string): Promise<ModelOutputs> {
  const safeModelId = String(modelId).replaceAll(/[\r\n]/g, "");
  console.info(`\nGenerating outputs for task: ${task.name}, model: [${safeModelId}]`);
  console.info(
    `Total test cases: ${task.testCases.length} (${task.testCases.length * RUNS_PER_TEST_CASE} runs)`,
  );

  const existingOutputs = await loadModelOutputs(task.id, modelId);
  const existingEntries = existingOutputs?.outputs ?? [];
  console.info(`Found ${existingEntries.length} existing outputs`);

  const runsToExecute = collectTestCaseRuns(task.testCases, existingEntries);
  console.info(`Generating ${runsToExecute.length} new outputs`);

  if (runsToExecute.length === 0) {
    console.info("All outputs already generated");
    return existingOutputs ?? createModelOutputs(task.id, modelId, []);
  }

  const results = await Promise.allSettled(
    runsToExecute.map(({ testCase, runNumber }) =>
      generateOutputForTestCase(task, testCase, modelId, runNumber),
    ),
  );

  const allOutputs = [...existingEntries, ...extractSuccessfulOutputs(results)];
  const modelOutputs = createModelOutputs(task.id, modelId, allOutputs);

  await saveModelOutputs(task.id, modelId, modelOutputs);
  console.info(`Saved ${allOutputs.length} total outputs`);

  return modelOutputs;
}
