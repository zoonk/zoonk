import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { toError } from "@zoonk/utils/error";
import { logError, logInfo } from "@zoonk/utils/logger";
import { buildBattleLeaderboard } from "./battle-loader";
import { resolveBattleMatchupModelIds } from "./battle-mapping";
import { addUsage, generateBattleRankings } from "./battle-score";
import { canJudge } from "./models";
import {
  getAllOutputsForTask,
  getModelsWithCompleteOutputs,
  getOutputForTestCase,
} from "./output-loader";
import { formatExpectationsWithCategories } from "./score-categories";
import { getTestCaseRunId } from "./test-case-runs";
import {
  type BattleCodeChecks,
  type BattleMatchup,
  type CategoryScore,
  type ModelOutputs,
  type ModelRanking,
  type RegisteredTask,
  type ScoreCategory,
  type TaskCodeChecks,
  type TestCase,
  getJudgeExpectations,
  supportsJudgeMode,
} from "./types";

const EVAL_RESULTS_DIR = path.join(process.cwd(), "eval-results");
const BATTLES_DIR = path.join(EVAL_RESULTS_DIR, "battles");
const OUTPUT_HASH_LENGTH = 16;

export const BATTLE_JUDGES: readonly string[] = [
  "anthropic/claude-opus-5.5",
  "google/gemini-4-argon",
  "openai/gpt-6-astra",
];

type ModelOutput = { modelId: string; output: string };
type Mapping = { anonymousId: string; modelId: string }[];
type AnonymizedOutput = { anonymousId: string; output: string }[];
type Judgment = BattleMatchup["judgments"][number];
type JudgeRunResult = { failures: Error[]; judgments: Judgment[] };

export type BattleOptions = {
  /** Exactly these models; otherwise the models with an output for every case. */
  modelIds?: string[];
  runsPerTestCase?: number;
  /** Read saved judgments only: a case-run without one for these outputs is listed, not judged. */
  saved?: boolean;
  /** Each judge ranks the outputs in both orders, and its scores are averaged. */
  swapped?: boolean;
};

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

function anonymizeOutputs(outputs: ModelOutput[]): {
  anonymizedOutputs: AnonymizedOutput;
  mapping: Mapping;
} {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const labeled = shuffleArray(outputs).map((item, index) => ({
    ...item,
    anonymousId: `Model ${letters[index]}`,
  }));

  return {
    anonymizedOutputs: labeled.map(({ anonymousId, output }) => ({ anonymousId, output })),
    mapping: labeled.map(({ anonymousId, modelId }) => ({ anonymousId, modelId })),
  };
}

function relabelOutputs(
  outputs: ModelOutput[],
  mapping: Mapping,
): { anonymizedOutputs: AnonymizedOutput; mapping: Mapping } {
  return {
    anonymizedOutputs: outputs.flatMap(({ modelId, output }) => {
      const entry = mapping.find((candidate) => candidate.modelId === modelId);
      return entry ? [{ anonymousId: entry.anonymousId, output }] : [];
    }),
    mapping,
  };
}

async function loadExistingMatchup(
  taskId: string,
  testCaseId: string,
): Promise<BattleMatchup | null> {
  const filePath = getMatchupFilePath(taskId, testCaseId);

  try {
    const data = await fs.readFile(filePath, "utf8");
    return resolveBattleMatchupModelIds(JSON.parse(data) as BattleMatchup);
  } catch {
    return null;
  }
}

/** So regenerated outputs get judged again instead of reusing the old outputs' rankings. */
export async function removeBattleMatchups({
  taskId,
  testCaseIds,
}: {
  taskId: string;
  testCaseIds: string[];
}): Promise<void> {
  await Promise.all(
    testCaseIds.map((testCaseId) => fs.rm(getMatchupFilePath(taskId, testCaseId), { force: true })),
  );
}

async function saveMatchup(matchup: BattleMatchup): Promise<void> {
  await ensureBattlesDir(matchup.taskId);
  const filePath = getMatchupFilePath(matchup.taskId, matchup.testCaseId);
  await fs.writeFile(filePath, JSON.stringify(matchup, null, 2));
}

function hashOutputs(outputs: ModelOutput[]): Record<string, string> {
  return Object.fromEntries(
    outputs.map(({ modelId, output }) => [
      modelId,
      createHash("sha256").update(output).digest("hex").slice(0, OUTPUT_HASH_LENGTH),
    ]),
  );
}

function hasSameOutputs({
  current,
  judged,
}: {
  current: Record<string, string>;
  judged?: Record<string, string>;
}): boolean {
  const models = Object.keys(current);

  return (
    judged !== undefined &&
    Object.keys(judged).length === models.length &&
    models.every((modelId) => judged[modelId] === current[modelId])
  );
}

/** Every model's label, from every judge: each judge leaves out its own family's models. */
function getMatchupMapping(matchup: BattleMatchup): Mapping {
  const mapping = new Map<string, string>();

  for (const ranking of matchup.judgments.flatMap((judgment) => judgment.rankings)) {
    if (!mapping.has(ranking.modelId)) {
      mapping.set(ranking.modelId, ranking.anonymousId);
    }
  }

  return [...mapping].map(([modelId, anonymousId]) => ({ anonymousId, modelId }));
}

/**
 * A saved matchup is reused only for the same outputs, models, rubric and order: a judgment of
 * another cohort, an older output or another rubric would compare something else.
 */
function canReuse(
  existing: BattleMatchup | null,
  {
    expectations,
    outputs,
    swapped,
  }: { expectations: string; outputs: Record<string, string>; swapped: boolean },
): existing is BattleMatchup {
  return (
    existing !== null &&
    existing.expectations === expectations &&
    Boolean(existing.swapped) === swapped &&
    hasSameOutputs({ current: outputs, judged: existing.outputs })
  );
}

function canJudgeAny({ judgeId, modelIds }: { judgeId: string; modelIds: string[] }): boolean {
  return modelIds.some((modelId) => canJudge({ judgeId, modelId }));
}

function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === "fulfilled";
}

function isRejected<T>(result: PromiseSettledResult<T>): result is PromiseRejectedResult {
  return result.status === "rejected";
}

function getFulfilledValues<T>(results: PromiseSettledResult<T>[]): T[] {
  return results.filter((result) => isFulfilled(result)).map((result) => result.value);
}

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

function averageCategoryScores(
  first?: CategoryScore[],
  second?: CategoryScore[],
): CategoryScore[] | undefined {
  return first?.map((category) => {
    const other = second?.find((score) => score.categoryId === category.categoryId);
    return other ? { ...category, score: (category.score + other.score) / 2 } : category;
  });
}

function averageRankings(first: ModelRanking[], second: ModelRanking[]): ModelRanking[] {
  return first.map((ranking) => {
    const other = second.find((candidate) => candidate.modelId === ranking.modelId);

    if (!other) {
      return ranking;
    }

    return {
      ...ranking,
      categoryScores: averageCategoryScores(ranking.categoryScores, other.categoryScores),
      reasoning: `${ranking.reasoning}\n\nIn the reverse order: ${other.reasoning}`,
      score: (ranking.score + other.score) / 2,
    };
  });
}

async function runJudge(params: {
  judgeId: string;
  anonymizedOutputs: AnonymizedOutput;
  expectations: string;
  userPrompt: string;
  mapping: Mapping;
  scoreCategories?: ScoreCategory[];
  swapped: boolean;
}): Promise<Judgment> {
  const { judgeId, anonymizedOutputs, mapping, swapped } = params;
  const eligibleMapping = mapping.filter((entry) => canJudge({ judgeId, modelId: entry.modelId }));
  const eligibleIds = new Set(eligibleMapping.map((entry) => entry.anonymousId));
  const eligibleOutputs = anonymizedOutputs.filter((output) => eligibleIds.has(output.anonymousId));

  const rank = (outputs: AnonymizedOutput) =>
    generateBattleRankings({
      anonymizedOutputs: outputs,
      expectations: params.expectations,
      judgeId,
      mapping: eligibleMapping,
      scoreCategories: params.scoreCategories,
      userPrompt: params.userPrompt,
    });

  const first = await rank(eligibleOutputs);

  if (!swapped) {
    return { judgeId, rankings: first.rankings, usage: first.usage };
  }

  const reversed = await rank(eligibleOutputs.toReversed());

  return {
    judgeId,
    rankings: averageRankings(first.rankings, reversed.rankings),
    usage: addUsage(first.usage, reversed.usage),
  };
}

async function runJudges({
  judgesToRun,
  ...params
}: Omit<Parameters<typeof runJudge>[0], "judgeId"> & {
  judgesToRun: readonly string[];
}): Promise<JudgeRunResult> {
  const results = await Promise.allSettled(
    judgesToRun.map((judgeId) => runJudge({ ...params, judgeId })),
  );

  return { failures: getRejectedErrors(results), judgments: getFulfilledValues(results) };
}

/** The checks a code-scored task's scorer runs, so a battle reports them beside its judges. */
async function checkOutputs({
  outputs,
  task,
  testCase,
}: {
  outputs: ModelOutput[];
  task: RegisteredTask;
  testCase: TestCase;
}): Promise<Record<string, BattleCodeChecks> | undefined> {
  const check = task.codeChecks as TaskCodeChecks | undefined;

  if (!check) {
    return undefined;
  }

  const results = await Promise.all(
    outputs.map(async ({ modelId, output }): Promise<[string, BattleCodeChecks]> => {
      const { passed, problems, total } = await check({ output, testCase });
      return [modelId, { passed, problems, total }];
    }),
  );

  return Object.fromEntries(results);
}

type CaseRunResult = { matchup: BattleMatchup | null; testCaseId: string };

async function runBattleForTestCase({
  allOutputs,
  options,
  runNumber,
  task,
  testCase,
}: {
  allOutputs: Map<string, ModelOutputs>;
  options: Required<Pick<BattleOptions, "saved" | "swapped">>;
  runNumber: number;
  task: RegisteredTask;
  testCase: TestCase;
}): Promise<CaseRunResult> {
  const testCaseId = getTestCaseRunId({ runNumber, testCaseId: testCase.id });

  const { outputs: modelOutputs, userPrompt } = collectModelOutputsForTestCase(
    testCaseId,
    allOutputs,
  );

  if (modelOutputs.length < 2) {
    if (options.saved) {
      return { matchup: null, testCaseId };
    }

    throw new Error(`Need at least 2 models with outputs for test case ${testCaseId}`);
  }

  const judgeExpectations = getJudgeExpectations(testCase);

  const expectations = formatExpectationsWithCategories({
    categories: task.scoreCategories,
    expectations: judgeExpectations,
  });

  const outputs = hashOutputs(modelOutputs);
  const existing = await loadExistingMatchup(task.id, testCaseId);

  const reusable = canReuse(existing, { expectations, outputs, swapped: options.swapped })
    ? existing
    : null;

  const codeChecks = await checkOutputs({ outputs: modelOutputs, task, testCase });

  if (options.saved) {
    return { matchup: reusable ? { ...reusable, codeChecks } : null, testCaseId };
  }

  const modelIds = modelOutputs.map((item) => item.modelId);
  const reusedMapping = reusable ? getMatchupMapping(reusable) : [];

  const keepsJudgments =
    reusable !== null &&
    modelIds.every((modelId) => reusedMapping.some((entry) => entry.modelId === modelId));

  const { anonymizedOutputs, mapping } = keepsJudgments
    ? relabelOutputs(modelOutputs, reusedMapping)
    : anonymizeOutputs(modelOutputs);

  const keptJudgments = keepsJudgments && reusable ? reusable.judgments : [];

  const judged = new Set(keptJudgments.map((judgment) => judgment.judgeId));

  const judgesToRun = BATTLE_JUDGES.filter(
    (judgeId) => !judged.has(judgeId) && canJudgeAny({ judgeId, modelIds }),
  );

  const judgeResults = await runJudges({
    anonymizedOutputs,
    expectations: judgeExpectations,
    judgesToRun,
    mapping,
    scoreCategories: task.scoreCategories,
    swapped: options.swapped,
    userPrompt,
  });

  const matchup: BattleMatchup = {
    codeChecks,
    expectations,
    judgedAt:
      judgeResults.judgments.length === 0 && reusable
        ? reusable.judgedAt
        : new Date().toISOString(),
    judgments: [...keptJudgments, ...judgeResults.judgments],
    outputs,
    swapped: options.swapped,
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

  logInfo(`Battle complete for ${testCaseId}`);
  return { matchup, testCaseId };
}

/**
 * Ranks the models with outputs for every case, or exactly `modelIds` (the CLI's `--battle`),
 * where a case a model failed to write is ranked without it. Returns the matchups, and with
 * `saved`, the case-runs that have no saved judgment for these outputs.
 */
export async function runBattleMode(
  task: RegisteredTask,
  { modelIds, runsPerTestCase = 1, saved = false, swapped = false }: BattleOptions = {},
): Promise<{ matchups: BattleMatchup[]; unjudged: string[] }> {
  if (!supportsJudgeMode(task)) {
    throw new Error(`Task ${task.id} does not support judge mode.`);
  }

  logInfo(`\n=== Starting Battle Mode for task: ${task.name} ===\n`);

  const battleModels = modelIds ?? (await getModelsWithCompleteOutputs({ runsPerTestCase, task }));

  if (battleModels.length < 2) {
    throw new Error(`Need at least 2 models with outputs. Found: ${battleModels.length}`);
  }

  logInfo(`Ranking ${battleModels.length} models`);

  const allOutputs = await getAllOutputsForTask(task.id);

  const battleOutputs = new Map(
    battleModels.flatMap((modelId): [string, ModelOutputs][] => {
      const outputs = allOutputs.get(modelId);
      return outputs ? [[modelId, outputs]] : [];
    }),
  );

  const caseRuns = task.testCases.flatMap((testCase) =>
    Array.from({ length: runsPerTestCase }, (_, index) => ({ runNumber: index + 1, testCase })),
  );

  const battleResults = await Promise.allSettled(
    caseRuns.map(({ runNumber, testCase }) =>
      runBattleForTestCase({
        allOutputs: battleOutputs,
        options: { saved, swapped },
        runNumber,
        task,
        testCase,
      }),
    ),
  );

  const battleFailures = getRejectedErrors(battleResults);

  if (battleFailures.length > 0) {
    throw new AggregateError(
      battleFailures,
      `${battleFailures.length} battle test case(s) failed; no completed matchup was discarded.`,
    );
  }

  const results = getFulfilledValues(battleResults);
  const matchups = results.flatMap((result) => (result.matchup ? [result.matchup] : []));
  const leaderboard = buildBattleLeaderboard({ allOutputs: battleOutputs, matchups });

  logInfo("\n=== Battle Mode Complete ===");
  logInfo("Top 3 models:");

  leaderboard.slice(0, 3).forEach((entry, i) => {
    logInfo(`  ${i + 1}. ${entry.modelName}: ${entry.averageScore.toFixed(2)} average`);
  });

  return {
    matchups,
    unjudged: results.flatMap((result) => (result.matchup ? [] : [result.testCaseId])),
  };
}
