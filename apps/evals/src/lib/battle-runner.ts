import fs from "node:fs/promises";
import path from "node:path";
import { getBattleLeaderboard } from "./battle-loader";
import { generateBattleRankings } from "./battle-score";
import {
  getAllOutputsForTask,
  getModelsWithCompleteOutputs,
  getOutputForTestCase,
} from "./output-loader";
import type { BattleMatchup, ModelOutputs, Task, TestCase } from "./types";

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
  anonymizedOutputs: Array<{ anonymousId: string; output: string }>;
  mapping: Array<{ anonymousId: string; modelId: string }>;
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

function anonymizeOutputs(
  outputs: Array<{ modelId: string; output: string }>,
): AnonymizationResult {
  const shuffled = shuffleArray(outputs);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const anonymizedOutputs: Array<{ anonymousId: string; output: string }> = [];
  const mapping: Array<{ anonymousId: string; modelId: string }> = [];

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
): Array<{ anonymousId: string; modelId: string }> {
  const firstJudgment = matchup.judgments[0];
  if (!firstJudgment) {
    return [];
  }

  return firstJudgment.rankings.map((r) => ({
    anonymousId: r.anonymousId,
    modelId: r.modelId,
  }));
}

function getMissingJudges(matchup: BattleMatchup): string[] {
  const existingJudges = new Set(matchup.judgments.map((j) => j.judgeId));
  return BATTLE_JUDGES_CONFIG.filter((j) => !existingJudges.has(j));
}

async function runBattleForTestCase(
  task: Task,
  testCase: TestCase,
  allOutputs: Map<string, ModelOutputs>,
  existingMatchup: BattleMatchup | null,
): Promise<BattleMatchup> {
  const testCaseId = `${testCase.id}-1`; // Assuming RUNS_PER_TEST_CASE = 1

  // Collect outputs from all models for this test case
  const modelOutputsForTestCase: Array<{ modelId: string; output: string }> =
    [];

  for (const [modelId, outputs] of allOutputs) {
    const output = getOutputForTestCase(outputs, testCaseId);
    if (output) {
      modelOutputsForTestCase.push({
        modelId,
        output: output.output,
      });
    }
  }

  if (modelOutputsForTestCase.length < 2) {
    throw new Error(
      `Need at least 2 models with outputs for test case ${testCaseId}`,
    );
  }

  // Use existing mapping or create new one
  let mapping: Array<{ anonymousId: string; modelId: string }>;
  let anonymizedOutputs: Array<{ anonymousId: string; output: string }>;

  if (existingMatchup) {
    mapping = extractMappingFromMatchup(existingMatchup);
    anonymizedOutputs = modelOutputsForTestCase.map((item) => {
      const mapEntry = mapping.find((m) => m.modelId === item.modelId);
      return {
        anonymousId: mapEntry?.anonymousId ?? item.modelId,
        output: item.output,
      };
    });
  } else {
    const result = anonymizeOutputs(modelOutputsForTestCase);
    mapping = result.mapping;
    anonymizedOutputs = result.anonymizedOutputs;
  }

  // Determine which judges need to run
  const judgesToRun = existingMatchup
    ? getMissingJudges(existingMatchup)
    : [...BATTLE_JUDGES_CONFIG];

  if (judgesToRun.length === 0 && existingMatchup) {
    return existingMatchup;
  }

  console.info(`\nRunning battle for test case: ${testCaseId}`);
  console.info(`  Judges to run: ${judgesToRun.join(", ")}`);

  // Get rankings from each judge in parallel
  const newJudgments = await Promise.all(
    judgesToRun.map(async (judgeId) => {
      const rankings = await generateBattleRankings({
        anonymizedOutputs,
        expectations: testCase.expectations,
        judgeId,
        mapping,
        testCaseId,
      });

      return {
        judgeId,
        rankings,
      };
    }),
  );

  // Merge with existing judgments
  const allJudgments = existingMatchup
    ? [...existingMatchup.judgments, ...newJudgments]
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
  const completeModels = await getModelsWithCompleteOutputs(
    task.id,
    totalTestCases,
  );

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
  await Promise.all(
    task.testCases.map(async (testCase) => {
      const testCaseId = `${testCase.id}-1`;
      const existingMatchup = await loadExistingMatchup(task.id, testCaseId);
      return runBattleForTestCase(
        task,
        testCase,
        completeOutputs,
        existingMatchup,
      );
    }),
  );

  const leaderboard = await getBattleLeaderboard(task.id);

  console.info("\n=== Battle Mode Complete ===");
  console.info("Top 3 models:");
  leaderboard.slice(0, 3).forEach((entry, i) => {
    console.info(`  ${i + 1}. ${entry.modelName}: ${entry.totalScore} points`);
  });
}
