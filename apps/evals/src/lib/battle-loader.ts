import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { type ModelConfig, getModelById, getModelDisplayName } from "./models";
import { getAllOutputsForTask } from "./output-loader";
import { type BattleLeaderboardEntry, type BattleMatchup, type ModelOutputs } from "./types";

const EVAL_RESULTS_DIR = path.join(process.cwd(), "eval-results");
const BATTLES_DIR = path.join(EVAL_RESULTS_DIR, "battles");

const TOKENS_PER_MILLION = 1_000_000;
const COST_MULTIPLIER = 1000;
const MS_TO_SECONDS = 1000;

export const getBattleMatchups = cache(async (taskId: string): Promise<BattleMatchup[]> => {
  const taskDir = path.join(BATTLES_DIR, taskId);

  try {
    const files = await fs.readdir(taskDir);
    const matchupFiles = files.filter(
      (file) => file.endsWith(".json") && file !== "leaderboard.json",
    );

    const matchups = await Promise.all(
      matchupFiles.map(async (file) => {
        const filePath = path.join(taskDir, file);
        const data = await fs.readFile(filePath, "utf8");
        return JSON.parse(data) as BattleMatchup;
      }),
    );

    return matchups.toSorted((a, b) => a.testCaseId.localeCompare(b.testCaseId));
  } catch {
    return [];
  }
});

function calculateCost(
  inputTokens: number,
  outputTokens: number,
  inputCost: number,
  outputCost: number,
): number {
  const totalInputCost = (inputTokens / TOKENS_PER_MILLION) * inputCost * COST_MULTIPLIER;
  const totalOutputCost = (outputTokens / TOKENS_PER_MILLION) * outputCost * COST_MULTIPLIER;
  return totalInputCost + totalOutputCost;
}

type ModelScores = {
  totalScore: number;
  scoresByJudge: Record<string, number>;
  scoresByTestCase: Record<string, number>;
};

function aggregateScoresFromMatchups(matchups: BattleMatchup[]): {
  modelScores: Map<string, ModelScores>;
  totalJudgments: number;
} {
  const modelScores = new Map<string, ModelScores>();
  let totalJudgments = 0;

  for (const matchup of matchups) {
    for (const judgment of matchup.judgments) {
      totalJudgments++;
      for (const ranking of judgment.rankings) {
        const existing = modelScores.get(ranking.modelId) ?? {
          scoresByJudge: {},
          scoresByTestCase: {},
          totalScore: 0,
        };

        existing.totalScore += ranking.score;
        existing.scoresByJudge[judgment.judgeId] =
          (existing.scoresByJudge[judgment.judgeId] ?? 0) + ranking.score;
        existing.scoresByTestCase[matchup.testCaseId] =
          (existing.scoresByTestCase[matchup.testCaseId] ?? 0) + ranking.score;

        modelScores.set(ranking.modelId, existing);
      }
    }
  }

  return { modelScores, totalJudgments };
}

function calculateModelMetrics(
  outputs: ModelOutputs | undefined,
  model: ModelConfig,
): { averageDuration: number; averageCost: number } {
  const numOutputs = outputs?.outputs.length ?? 0;

  if (numOutputs === 0 || !outputs) {
    return { averageCost: 0, averageDuration: 0 };
  }

  const totalDurationMs = outputs.outputs.reduce((sum, output) => sum + output.duration, 0);
  const averageDuration = totalDurationMs / numOutputs / MS_TO_SECONDS;

  const avgInputTokens =
    outputs.outputs.reduce((sum, output) => sum + output.inputTokens, 0) / numOutputs;
  const avgOutputTokens =
    outputs.outputs.reduce((sum, output) => sum + output.outputTokens, 0) / numOutputs;

  const averageCost = calculateCost(
    avgInputTokens,
    avgOutputTokens,
    model.inputCost,
    model.outputCost,
  );

  return { averageCost, averageDuration };
}

function buildLeaderboardEntry(
  modelId: string,
  scores: ModelScores,
  allOutputs: Map<string, ModelOutputs>,
  matchupsCount: number,
): BattleLeaderboardEntry | null {
  const model = getModelById(modelId);
  if (!model) {
    return null;
  }

  const outputs = allOutputs.get(modelId);
  const { averageCost, averageDuration } = calculateModelMetrics(outputs, model);

  return {
    averageCost,
    averageDuration,
    averageScore: matchupsCount > 0 ? scores.totalScore / matchupsCount : 0,
    modelId,
    modelName: getModelDisplayName(model),
    provider: modelId.split("/")[0] ?? modelId,
    scoresByJudge: scores.scoresByJudge,
    scoresByTestCase: scores.scoresByTestCase,
    totalScore: scores.totalScore,
  };
}

export const getBattleLeaderboard = cache(
  async (taskId: string): Promise<BattleLeaderboardEntry[]> => {
    const [matchups, allOutputs] = await Promise.all([
      getBattleMatchups(taskId),
      getAllOutputsForTask(taskId),
    ]);

    if (matchups.length === 0) {
      return [];
    }

    const { modelScores } = aggregateScoresFromMatchups(matchups);

    const entries: BattleLeaderboardEntry[] = [];

    for (const [modelId, scores] of modelScores) {
      const entry = buildLeaderboardEntry(modelId, scores, allOutputs, matchups.length);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries.toSorted((a, b) => b.totalScore - a.totalScore);
  },
);
