import fs from "node:fs/promises";
import path from "node:path";
import { RUNS_PER_TEST_CASE, getTaskById } from "@/tasks";
import { logError, logInfo } from "@zoonk/utils/logger";
import { cache } from "react";
import { hashJson } from "./comparisons/identity";
import { writeBytes } from "./comparisons/storage";
import { findTestCaseForOutput, loadModelOutputs } from "./output-loader";
import { generateScore } from "./score";
import { getTestCaseRunIds } from "./test-case-runs";
import {
  type ModelOutputs,
  type OutputEntry,
  type RegisteredTask,
  type ScoredResult,
  type ScoredTaskResults,
  type TaskEvalResults,
  type TaskScoreResult,
  type TestCase,
  getJudgeExpectations,
} from "./types";

const EVAL_RESULTS_DIR = path.join(process.cwd(), "eval-results");
const RESULTS_DIR = path.join(EVAL_RESULTS_DIR, "results");

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
  const taskResults: ScoredTaskResults = { modelId, results, taskId };

  const filePath = getResultsFilePath(taskId, modelId);
  await writeBytes(filePath, JSON.stringify(taskResults, null, 2), true);
}

export async function deleteModelResults({
  modelId,
  taskId,
}: {
  modelId: string;
  taskId: string;
}): Promise<void> {
  await fs.rm(getResultsFilePath(taskId, modelId), { force: true });
}

export async function removeModelResultRuns({
  modelId,
  runIds,
  taskId,
}: {
  modelId: string;
  runIds: ReadonlySet<string>;
  taskId: string;
}): Promise<void> {
  const results = await loadExistingScoredResults(taskId, modelId);

  if (results.length === 0) {
    return;
  }

  await saveScoredResults(
    taskId,
    modelId,
    results.filter((result) => !runIds.has(result.testCase.id)),
  );
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

  const scoreResult: TaskScoreResult = task.score
    ? await task.score({ output: output.output, testCase } as never)
    : await generateScore({
        expectations: getJudgeExpectations(testCase),
        output: output.output,
        prompt: output.userPrompt,
        scoreCategories: task.scoreCategories,
      });

  logInfo(scoreResult.listeningReview?.conclusion ?? `Score: ${scoreResult.score}`);

  const testCaseWithRun: TestCase = { ...testCase, id: output.testCaseId };

  return {
    categoryScores: scoreResult.categoryScores,
    classification: scoreResult.classification,
    itemsScored: scoreResult.itemsScored,
    judge: scoreResult.judge,
    keyFlaws: scoreResult.keyFlaws,
    listeningReview: scoreResult.listeningReview,
    outputHash: task.output === "image" ? hashJson(output) : undefined,
    steps: scoreResult.steps,
    testCase: testCaseWithRun,
  };
}

function matchesOutput(result: ScoredResult, output: OutputEntry): boolean {
  if (result.outputHash) {
    return result.outputHash === hashJson(output);
  }

  // Legacy image reviews describe the shared filenames written before generation provenance.
  return !result.imageReview || !output.generation?.sourceHash;
}

function matchingResults(outputs: OutputEntry[], results: ScoredResult[]) {
  const byId = new Map(outputs.map((output) => [output.testCaseId, output]));

  return results.filter((result) => {
    const output = byId.get(result.testCase.id);
    return output && matchesOutput(result, output);
  });
}

export async function getImageRunsToReplace(modelOutputs: ModelOutputs) {
  const { modelId, outputs, taskId } = modelOutputs;
  const applicable = matchingResults(outputs, await loadExistingScoredResults(taskId, modelId));

  const valid = new Set(
    applicable.filter((result) => !result.imageReview).map((result) => result.testCase.id),
  );

  return new Set(
    applicable
      .filter((result) => result.imageReview && !valid.has(result.testCase.id))
      .map((result) => result.testCase.id),
  );
}

export async function runEval(
  task: RegisteredTask,
  modelId: string,
  runIds: ReadonlySet<string> = new Set(
    getTestCaseRunIds({ runsPerTestCase: RUNS_PER_TEST_CASE, testCases: task.testCases }),
  ),
): Promise<TaskEvalResults> {
  const safeModelId = modelId.replaceAll(/[\r\n]/gu, "");

  logInfo(`\nStarting eval for task: ${task.name}, model: [${safeModelId}]`);

  const modelOutputs = await loadModelOutputs(task.id, modelId);

  if (modelOutputs?.outputs.length === 0 && modelOutputs.failedRuns) {
    logInfo("No outputs to score: every run failed.");
    return combineOutputsAndResults(task.id, modelId, modelOutputs, []);
  }

  if (!modelOutputs || modelOutputs.outputs.length === 0) {
    throw new Error(`No outputs found for model ${modelId}. Generate outputs first.`);
  }

  logInfo(`Found ${modelOutputs.outputs.length} saved outputs`);

  const existingResults = await loadExistingScoredResults(task.id, modelId);

  const savedRuns = new Set(
    matchingResults(modelOutputs.outputs, existingResults).map((result) => result.testCase.id),
  );

  logInfo(`Found ${existingResults.length} saved evaluation records`);

  const outputsToScore = modelOutputs.outputs.filter(
    (output) => runIds.has(output.testCaseId) && !savedRuns.has(output.testCaseId),
  );

  logInfo(`Scoring ${outputsToScore.length} outputs`);

  if (outputsToScore.length === 0) {
    logInfo("Reusing saved evaluation records");
    return combineOutputsAndResults(task.id, modelId, modelOutputs, existingResults);
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

  const rescoredRuns = new Set(newResults.map((result) => result.testCase.id));

  const allScoredResults = [
    ...existingResults.filter((result) => !rescoredRuns.has(result.testCase.id)),
    ...newResults,
  ];

  await saveScoredResults(task.id, modelId, allScoredResults);
  logInfo(`Saved ${allScoredResults.length} evaluation records`);

  return combineOutputsAndResults(task.id, modelId, modelOutputs, allScoredResults);
}

function combineOutputsAndResults(
  taskId: string,
  modelId: string,
  { failedRuns, outputs }: Pick<ModelOutputs, "failedRuns" | "outputs">,
  scoredResults: ScoredResult[],
): TaskEvalResults {
  const results = scoredResults.flatMap((scored) => {
    const output = outputs.find((entry) => entry.testCaseId === scored.testCase.id);

    if (!output || !matchesOutput(scored, output)) {
      return [];
    }

    return {
      audioSeconds: output.audioSeconds,
      cacheReadTokens: output.cacheReadTokens,
      cacheWriteTokens: output.cacheWriteTokens,
      calls: output.calls,
      categoryScores: scored.categoryScores,
      classification: scored.classification,
      duration: output.duration,
      extraCalls: output.extraCalls,
      imageReview: scored.imageReview,
      images: output.images,
      inputTokens: output.inputTokens,
      itemsScored: scored.itemsScored,
      judge: scored.judge,
      keyFlaws: scored.keyFlaws,
      listeningReview: scored.listeningReview,
      output: output.output,
      outputTokens: output.outputTokens,
      reasoningTokens: output.reasoningTokens,
      steps: scored.steps,
      testCase: scored.testCase,
    };
  });

  return { failedRuns, modelId, outputs, results, taskId };
}

export const getTaskResults = cache(
  async (
    taskId: string,
    modelId: string,
    runIds?: ReadonlySet<string>,
  ): Promise<TaskEvalResults | null> => {
    const task = getTaskById(taskId);

    if (!task) {
      return null;
    }

    const currentRunIds =
      runIds ??
      new Set(
        getTestCaseRunIds({ runsPerTestCase: RUNS_PER_TEST_CASE, testCases: task.testCases }),
      );

    const modelOutputs = await loadModelOutputs(taskId, modelId);

    if (!modelOutputs) {
      return null;
    }

    const scoredResults = await loadExistingScoredResults(taskId, modelId);

    return combineOutputsAndResults(
      taskId,
      modelId,
      {
        failedRuns: modelOutputs.failedRuns?.filter((run) => currentRunIds.has(run.testCaseId)),
        outputs: modelOutputs.outputs.filter((output) => currentRunIds.has(output.testCaseId)),
      },
      scoredResults.filter((result) => currentRunIds.has(result.testCase.id)),
    );
  },
);
