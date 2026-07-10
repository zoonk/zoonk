import fs from "node:fs/promises";
import path from "node:path";
import { toError } from "@zoonk/utils/error";
import { logError, logInfo } from "@zoonk/utils/logger";
import { getBattleLeaderboard } from "./battle-loader";
import { generateBattleRankings } from "./battle-score";
import {
  getAllOutputsForTask,
  getModelsWithCompleteOutputs,
  getOutputForTestCase,
} from "./output-loader";
import {
  type BattleMatchup,
  type ModelOutputs,
  type RegisteredTask,
  type TestCase,
  getJudgeExpectations,
  hasJudgeExpectations,
} from "./types";

const EVAL_RESULTS_DIR = path.join(process.cwd(), "eval-results");
const BATTLES_DIR = path.join(EVAL_RESULTS_DIR, "battles");

// Battle judges - easy to extend
const BATTLE_JUDGES_CONFIG: readonly string[] = [
  "anthropic/claude-opus-4.8",
  "google/gemini-3.1-pro-preview",
  "openai/gpt-5.6-sol",
];

async function ensureBattlesDir(taskId: string) {
  const taskDir = path.join(BATTLES_DIR, taskId);
  await fs.mkdir(taskDir, { recursive: true });
}

function getMatchupFilePath(taskId: string, testCaseId: string): string {
  return path.join(BATTLES_DIR, taskId, `${testCaseId}.json`);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j] as T;
    shuffled[j] = temp as T;
  }

  return shuffled;
}

function anonymizeOutputs(outputs: { modelId: string; output: string }[]): {
  anonymizedOutputs: { anonymousId: string; output: string }[];
  mapping: { anonymousId: string; modelId: string }[];
} {
  const shuffled = shuffleArray(outputs);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const anonymizedOutputs: { anonymousId: string; output: string }[] = [];
  const mapping: { anonymousId: string; modelId: string }[] = [];

  shuffled.forEach((item, index) => {
    const anonymousId = `Model ${letters[index]}`;
    anonymizedOutputs.push({ anonymousId, output: item.output });
    mapping.push({ anonymousId, modelId: item.modelId });
  });

  return { anonymizedOutputs, mapping };
}

async function loadExistingMatchup(
  taskId: string,
  testCaseId: string,
): Promise<BattleMatchup | null> {
  const filePath = getMatchupFilePath(taskId, testCaseId);

  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data) as BattleMatchup;
  } catch {
    return null;
  }
}

async function saveMatchup(matchup: BattleMatchup): Promise<void> {
  await ensureBattlesDir(matchup.taskId);
  const filePath = getMatchupFilePath(matchup.taskId, matchup.testCaseId);
  await fs.writeFile(filePath, JSON.stringify(matchup, null, 2));
}

function extractMappingFromMatchup(
  matchup: BattleMatchup,
): { anonymousId: string; modelId: string }[] {
  const firstJudgment = matchup.judgments[0];

  if (!firstJudgment) {
    return [];
  }

  return firstJudgment.rankings.map((ranking) => ({
    anonymousId: ranking.anonymousId,
    modelId: ranking.modelId,
  }));
}

function getMissingJudges(matchup: BattleMatchup): string[] {
  const existingJudges = new Set(matchup.judgments.map((judgment) => judgment.judgeId));
  return BATTLE_JUDGES_CONFIG.filter((judgeId) => !existingJudges.has(judgeId));
}

function hasNewModels(existingMatchup: BattleMatchup, currentModelIds: string[]): boolean {
  const existingModelIds = new Set(
    extractMappingFromMatchup(existingMatchup).map((item) => item.modelId),
  );

  return currentModelIds.some((modelId) => !existingModelIds.has(modelId));
}

type ModelOutput = { modelId: string; output: string };
type Mapping = { anonymousId: string; modelId: string }[];
type AnonymizedOutput = { anonymousId: string; output: string }[];
type JudgeRunResult = { failures: Error[]; judgments: BattleMatchup["judgments"] };

/**
 * Narrows settled results before their values are collected. Battle mode uses
 * the same helper for judge and test-case waves so fulfilled work is preserved
 * without duplicating status branches inside array transformations.
 */
function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === "fulfilled";
}

/**
 * Narrows rejected results so unknown promise rejection values can be
 * normalized into real Error instances before they are logged or aggregated.
 */
function isRejected<T>(result: PromiseSettledResult<T>): result is PromiseRejectedResult {
  return result.status === "rejected";
}

/**
 * Keeps every successful result from a settled parallel wave. A failed judge
 * must not erase other judges that completed and can be persisted for the next
 * incremental battle run.
 */
function getFulfilledValues<T>(results: PromiseSettledResult<T>[]): T[] {
  return results.filter((result) => isFulfilled(result)).map((result) => result.value);
}

/**
 * Converts all rejected values from a settled wave into Error instances so an
 * AggregateError can retain every failure instead of reporting only the first.
 */
function getRejectedErrors<T>(results: PromiseSettledResult<T>[]): Error[] {
  return results.filter((result) => isRejected(result)).map((result) => toError(result.reason));
}

function collectModelOutputsForTestCase(
  testCaseId: string,
  allOutputs: Map<string, ModelOutputs>,
): { outputs: ModelOutput[]; userPrompt: string } {
  const outputs: ModelOutput[] = [];
  let userPrompt = "";

  for (const [modelId, modelOutputs] of allOutputs) {
    const output = getOutputForTestCase(modelOutputs, testCaseId);

    if (output) {
      outputs.push({ modelId, output: output.output });

      if (!userPrompt) {
        userPrompt = output.userPrompt;
      }
    }
  }

  return { outputs, userPrompt };
}

function getAnonymizationForBattle(
  modelOutputs: ModelOutput[],
  existingMatchup: BattleMatchup | null,
): { mapping: Mapping; anonymizedOutputs: AnonymizedOutput } {
  if (!existingMatchup) {
    return anonymizeOutputs(modelOutputs);
  }

  const mapping = extractMappingFromMatchup(existingMatchup);

  const anonymizedOutputs = modelOutputs.map((item) => {
    const mapEntry = mapping.find((entry) => entry.modelId === item.modelId);
    return { anonymousId: mapEntry?.anonymousId ?? item.modelId, output: item.output };
  });

  return { anonymizedOutputs, mapping };
}

/**
 * Runs one judge independently so the enclosing settled wave can retain both
 * the judge identity and any rankings it successfully produced.
 */
async function runJudge(params: {
  judgeId: string;
  anonymizedOutputs: AnonymizedOutput;
  expectations: string;
  userPrompt: string;
  mapping: Mapping;
}): Promise<BattleMatchup["judgments"][number]> {
  const { judgeId, anonymizedOutputs, expectations, userPrompt, mapping } = params;

  return {
    judgeId,
    rankings: await generateBattleRankings({
      anonymizedOutputs,
      expectations,
      judgeId,
      mapping,
      userPrompt,
    }),
  };
}

/**
 * Lets all configured judges finish even when one fails. Successful judgments
 * are returned separately from failures so the caller can save partial work
 * before surfacing an incomplete matchup.
 */
async function runJudges(params: {
  judgesToRun: readonly string[];
  anonymizedOutputs: AnonymizedOutput;
  expectations: string;
  userPrompt: string;
  mapping: Mapping;
}): Promise<JudgeRunResult> {
  const { judgesToRun, anonymizedOutputs, expectations, userPrompt, mapping } = params;

  const results = await Promise.allSettled(
    judgesToRun.map((judgeId) =>
      runJudge({ anonymizedOutputs, expectations, judgeId, mapping, userPrompt }),
    ),
  );

  return { failures: getRejectedErrors(results), judgments: getFulfilledValues(results) };
}

/**
 * Builds and persists one matchup while retaining any judge results that
 * succeeded. Failed judges remain missing in the saved matchup so the existing
 * incremental path retries only those judges on the next run.
 */
async function runBattleForTestCase({
  allOutputs,
  existingMatchup,
  task,
  testCase,
}: {
  allOutputs: Map<string, ModelOutputs>;
  existingMatchup: BattleMatchup | null;
  task: RegisteredTask;
  testCase: TestCase;
}): Promise<BattleMatchup> {
  const testCaseId = `${testCase.id}-1`;
  const expectations = getJudgeExpectations(testCase);

  const { outputs: modelOutputs, userPrompt } = collectModelOutputsForTestCase(
    testCaseId,
    allOutputs,
  );

  if (modelOutputs.length < 2) {
    throw new Error(`Need at least 2 models with outputs for test case ${testCaseId}`);
  }

  const currentModelIds = modelOutputs.map((item) => item.modelId);
  const newModelsDetected = existingMatchup && hasNewModels(existingMatchup, currentModelIds);

  if (newModelsDetected) {
    logInfo(`New models detected for ${testCaseId}, re-running all judges`);
  }

  const effectiveExisting = newModelsDetected ? null : existingMatchup;
  const { mapping, anonymizedOutputs } = getAnonymizationForBattle(modelOutputs, effectiveExisting);

  const judgesToRun = effectiveExisting
    ? getMissingJudges(effectiveExisting)
    : [...BATTLE_JUDGES_CONFIG];

  if (judgesToRun.length === 0 && effectiveExisting) {
    return effectiveExisting;
  }

  const judgeResults = await runJudges({
    anonymizedOutputs,
    expectations,
    judgesToRun,
    mapping,
    userPrompt,
  });

  const allJudgments = effectiveExisting
    ? [...effectiveExisting.judgments, ...judgeResults.judgments]
    : judgeResults.judgments;

  const matchup: BattleMatchup = {
    expectations,
    judgedAt: new Date().toISOString(),
    judgments: allJudgments,
    taskId: task.id,
    testCaseId,
  };

  if (judgeResults.judgments.length > 0) {
    await saveMatchup(matchup);
  }

  if (judgeResults.failures.length > 0) {
    judgeResults.failures.forEach((error) =>
      logError(`Battle judge failed for ${testCaseId}:`, error),
    );

    throw new AggregateError(
      judgeResults.failures,
      `${judgeResults.failures.length} battle judge(s) failed for ${testCaseId}; no completed judgment was discarded.`,
    );
  }

  return matchup;
}

/**
 * Runs one test case and logs completion only after its matchup is safely
 * persisted. Keeping this unit named leaves the outer settled wave declarative.
 */
async function runBattleTestCase({
  completeOutputs,
  task,
  testCase,
}: {
  completeOutputs: Map<string, ModelOutputs>;
  task: RegisteredTask;
  testCase: TestCase;
}): Promise<BattleMatchup> {
  const testCaseId = `${testCase.id}-1`;
  const existingMatchup = await loadExistingMatchup(task.id, testCaseId);

  const result = await runBattleForTestCase({
    allOutputs: completeOutputs,
    existingMatchup,
    task,
    testCase,
  });

  logInfo(`Battle complete for ${testCaseId}`);
  return result;
}

export async function runBattleMode(task: RegisteredTask): Promise<void> {
  if (!hasJudgeExpectations(task)) {
    throw new Error(`Task ${task.id} does not define expectations for judge mode.`);
  }

  logInfo(`\n=== Starting Battle Mode for task: ${task.name} ===\n`);

  const totalTestCases = task.testCases.length;

  // Get all models with complete outputs
  const completeModels = await getModelsWithCompleteOutputs(task.id, totalTestCases);

  if (completeModels.length < 2) {
    throw new Error(
      `Need at least 2 models with complete outputs. Found: ${completeModels.length}`,
    );
  }

  logInfo(`Found ${completeModels.length} models with complete outputs`);

  // Load all outputs
  const allOutputs = await getAllOutputsForTask(task.id);

  // Filter to only include complete models
  const completeOutputs = new Map<string, ModelOutputs>();

  for (const modelId of completeModels) {
    const outputs = allOutputs.get(modelId);

    if (outputs) {
      completeOutputs.set(modelId, outputs);
    }
  }

  // Run battles for each test case (incremental - only runs missing judges)
  const battleResults = await Promise.allSettled(
    task.testCases.map((testCase) => runBattleTestCase({ completeOutputs, task, testCase })),
  );

  const battleFailures = getRejectedErrors(battleResults);

  if (battleFailures.length > 0) {
    throw new AggregateError(
      battleFailures,
      `${battleFailures.length} battle test case(s) failed; no completed matchup was discarded.`,
    );
  }

  const leaderboard = await getBattleLeaderboard(task.id);

  logInfo("\n=== Battle Mode Complete ===");
  logInfo("Top 3 models:");

  leaderboard.slice(0, 3).forEach((entry, i) => {
    logInfo(`  ${i + 1}. ${entry.modelName}: ${entry.totalScore} points`);
  });
}
