import fs from "node:fs/promises";
import path from "node:path";
import { getBattleLeaderboard } from "./battle-loader";
import { generateBattleRankings } from "./battle-score";
import {
  getAllOutputsForTask,
  getModelsWithCompleteOutputs,
  getOutputForTestCase,
} from "./output-loader";
import { type BattleMatchup, type ModelOutputs, type Task, type TestCase } from "./types";

const EVAL_RESULTS_DIR = path.join(process.cwd(), "eval-results");
const BATTLES_DIR = path.join(EVAL_RESULTS_DIR, "battles");

// Battle judges - easy to extend
const BATTLE_JUDGES_CONFIG: readonly string[] = [
  "anthropic/claude-opus-4.5",
  "google/gemini-3-pro-preview",
  "openai/gpt-5.2",
];

async function ensureBattlesDir(taskId: string) {
  const taskDir = path.join(BATTLES_DIR, taskId);
  await fs.mkdir(taskDir, { recursive: true });
}

function getMatchupFilePath(taskId: string, testCaseId: string): string {
  return path.join(BATTLES_DIR, taskId, `${testCaseId}.json`);
}

type AnonymizationResult = {
  anonymizedOutputs: { anonymousId: string; output: string }[];
  mapping: { anonymousId: string; modelId: string }[];
};

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j] as T;
    shuffled[j] = temp as T;
  }
  return shuffled;
}

function anonymizeOutputs(outputs: { modelId: string; output: string }[]): AnonymizationResult {
  const shuffled = shuffleArray(outputs);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const anonymizedOutputs: { anonymousId: string; output: string }[] = [];
  const mapping: { anonymousId: string; modelId: string }[] = [];

  shuffled.forEach((item, index) => {
    const anonymousId = `Model ${letters[index]}`;
    anonymizedOutputs.push({
      anonymousId,
      output: item.output,
    });
    mapping.push({
      anonymousId,
      modelId: item.modelId,
    });
  });

  return { anonymizedOutputs, mapping };
}

async function loadExistingMatchup(
  taskId: string,
  testCaseId: string,
): Promise<BattleMatchup | null> {
  const filePath = getMatchupFilePath(taskId, testCaseId);
  try {
    const data = await fs.readFile(filePath, "utf-8");
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

function collectModelOutputsForTestCase(
  testCaseId: string,
  allOutputs: Map<string, ModelOutputs>,
): ModelOutput[] {
  const outputs: ModelOutput[] = [];
  for (const [modelId, modelOutputs] of allOutputs) {
    const output = getOutputForTestCase(modelOutputs, testCaseId);
    if (output) {
      outputs.push({ modelId, output: output.output });
    }
  }
  return outputs;
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

async function runJudges(
  judgesToRun: readonly string[],
  anonymizedOutputs: AnonymizedOutput,
  expectations: string,
  mapping: Mapping,
): Promise<BattleMatchup["judgments"]> {
  return Promise.all(
    judgesToRun.map(async (judgeId) => ({
      judgeId,
      rankings: await generateBattleRankings({ anonymizedOutputs, expectations, judgeId, mapping }),
    })),
  );
}

async function runBattleForTestCase(
  task: Task,
  testCase: TestCase,
  allOutputs: Map<string, ModelOutputs>,
  existingMatchup: BattleMatchup | null,
): Promise<BattleMatchup> {
  const testCaseId = `${testCase.id}-1`;
  const modelOutputs = collectModelOutputsForTestCase(testCaseId, allOutputs);

  if (modelOutputs.length < 2) {
    throw new Error(`Need at least 2 models with outputs for test case ${testCaseId}`);
  }

  const currentModelIds = modelOutputs.map((item) => item.modelId);
  const newModelsDetected = existingMatchup && hasNewModels(existingMatchup, currentModelIds);
  if (newModelsDetected) {
    console.info(`New models detected for ${testCaseId}, re-running all judges`);
  }

  const effectiveExisting = newModelsDetected ? null : existingMatchup;
  const { mapping, anonymizedOutputs } = getAnonymizationForBattle(modelOutputs, effectiveExisting);

  const judgesToRun = effectiveExisting
    ? getMissingJudges(effectiveExisting)
    : [...BATTLE_JUDGES_CONFIG];
  if (judgesToRun.length === 0 && effectiveExisting) {
    return effectiveExisting;
  }

  const newJudgments = await runJudges(
    judgesToRun,
    anonymizedOutputs,
    testCase.expectations,
    mapping,
  );
  const allJudgments = effectiveExisting
    ? [...effectiveExisting.judgments, ...newJudgments]
    : newJudgments;

  const matchup: BattleMatchup = {
    expectations: testCase.expectations,
    judgedAt: new Date().toISOString(),
    judgments: allJudgments,
    taskId: task.id,
    testCaseId,
  };

  await saveMatchup(matchup);
  return matchup;
}

export async function runBattleMode(task: Task): Promise<void> {
  console.info(`\n=== Starting Battle Mode for task: ${task.name} ===\n`);

  const totalTestCases = task.testCases.length;

  // Get all models with complete outputs
  const completeModels = await getModelsWithCompleteOutputs(task.id, totalTestCases);

  if (completeModels.length < 2) {
    throw new Error(
      `Need at least 2 models with complete outputs. Found: ${completeModels.length}`,
    );
  }

  console.info(`Found ${completeModels.length} models with complete outputs`);

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
  const totalBattles = task.testCases.length;
  let completedBattles = 0;

  await Promise.all(
    task.testCases.map(async (testCase) => {
      const testCaseId = `${testCase.id}-1`;
      const existingMatchup = await loadExistingMatchup(task.id, testCaseId);
      const result = await runBattleForTestCase(task, testCase, completeOutputs, existingMatchup);

      completedBattles++;
      const remaining = totalBattles - completedBattles;
      console.info(`Battle complete for ${testCaseId}, ${remaining} remaining`);

      return result;
    }),
  );

  const leaderboard = await getBattleLeaderboard(task.id);

  console.info("\n=== Battle Mode Complete ===");
  console.info("Top 3 models:");
  leaderboard.slice(0, 3).forEach((entry, i) => {
    console.info(`  ${i + 1}. ${entry.modelName}: ${entry.totalScore} points`);
  });
}
