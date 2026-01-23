import { RUNS_PER_TEST_CASE } from "@/tasks";
import { getGatewayModelId, getModelById } from "./models";
import { loadModelOutputs, saveModelOutputs } from "./output-loader";
import type { ModelOutputs, OutputEntry, Task, TestCase } from "./types";

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

export async function generateOutputs(task: Task, modelId: string): Promise<ModelOutputs> {
  const safeModelId = String(modelId).replace(/[\r\n]/g, "");
  const totalRuns = task.testCases.length * RUNS_PER_TEST_CASE;

  console.info(`\nGenerating outputs for task: ${task.name}, model: [${safeModelId}]`);
  console.info(
    `Total test cases: ${task.testCases.length} (${totalRuns} runs with ${RUNS_PER_TEST_CASE} iterations each)`,
  );

  const existingOutputs = await loadModelOutputs(task.id, modelId);
  const existingEntries = existingOutputs?.outputs ?? [];
  console.info(`Found ${existingEntries.length} existing outputs`);

  const testCaseRunsToExecute: {
    testCase: TestCase;
    runNumber: number;
  }[] = [];

  for (const testCase of task.testCases) {
    for (let runNumber = 1; runNumber <= RUNS_PER_TEST_CASE; runNumber++) {
      if (!shouldSkipTestCase(existingEntries, testCase.id, runNumber)) {
        testCaseRunsToExecute.push({ runNumber, testCase });
      }
    }
  }

  console.info(`Generating ${testCaseRunsToExecute.length} new outputs`);

  if (testCaseRunsToExecute.length === 0) {
    console.info("All outputs already generated");
    // ExistingOutputs is guaranteed to exist here since existingEntries was derived from it
    return (
      existingOutputs ?? {
        generatedAt: new Date().toISOString(),
        modelId,
        outputs: [],
        taskId: task.id,
      }
    );
  }

  const results = await Promise.allSettled(
    testCaseRunsToExecute.map(({ testCase, runNumber }) =>
      generateOutputForTestCase(task, testCase, modelId, runNumber),
    ),
  );

  const newOutputs: OutputEntry[] = results
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

  const allOutputs = [...existingEntries, ...newOutputs];

  const modelOutputs: ModelOutputs = {
    generatedAt: new Date().toISOString(),
    modelId,
    outputs: allOutputs,
    taskId: task.id,
  };

  await saveModelOutputs(task.id, modelId, modelOutputs);
  console.info(`Saved ${allOutputs.length} total outputs`);

  return modelOutputs;
}
