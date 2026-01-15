import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { getModelById, getModelDisplayName } from "./models";
import { getAllOutputsForTask } from "./output-loader";
import type { BattleLeaderboardEntry, BattleMatchup } from "./types";

const EVAL_RESULTS_DIR = path.join(process.cwd(), "eval-results");
const BATTLES_DIR = path.join(EVAL_RESULTS_DIR, "battles");

const TOKENS_PER_MILLION = 1_000_000;
const COST_MULTIPLIER = 1000;
const MS_TO_SECONDS = 1000;

function getMatchupFilePath(taskId: string, testCaseId: string): string {
  return path.join(BATTLES_DIR, taskId, `${testCaseId}.json`);
}

export const getBattleMatchup = cache(
  async (taskId: string, testCaseId: string): Promise<BattleMatchup | null> => {
    const filePath = getMatchupFilePath(taskId, testCaseId);
    try {
      const data = await fs.readFile(filePath, "utf-8");
      return JSON.parse(data) as BattleMatchup;
    } catch {
      return null;
    }
  },
);

export const getBattleMatchups = cache(
  async (taskId: string): Promise<BattleMatchup[]> => {
    const taskDir = path.join(BATTLES_DIR, taskId);

    try {
      const files = await fs.readdir(taskDir);
      const matchupFiles = files.filter(
        (f) => f.endsWith(".json") && f !== "leaderboard.json",
      );

      const matchups = await Promise.all(
        matchupFiles.map(async (file) => {
          const filePath = path.join(taskDir, file);
          const data = await fs.readFile(filePath, "utf-8");
          return JSON.parse(data) as BattleMatchup;
        }),
      );

      return matchups.sort((a, b) => a.testCaseId.localeCompare(b.testCaseId));
    } catch {
      return [];
    }
  },
);

function calculateCost(
  inputTokens: number,
  outputTokens: number,
  inputCost: number,
  outputCost: number,
): number {
  const totalInputCost =
    (inputTokens / TOKENS_PER_MILLION) * inputCost * COST_MULTIPLIER;
  const totalOutputCost =
    (outputTokens / TOKENS_PER_MILLION) * outputCost * COST_MULTIPLIER;
  return totalInputCost + totalOutputCost;
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

    // Aggregate scores from all matchups
    const modelScores = new Map<
      string,
      {
        totalScore: number;
        scoresByJudge: Record<string, number>;
        scoresByTestCase: Record<string, number>;
      }
    >();

    let totalJudgments = 0;

    for (const matchup of matchups) {
      for (const judgment of matchup.judgments) {
        totalJudgments++;
        for (const ranking of judgment.rankings) {
          const existing = modelScores.get(ranking.modelId) ?? {
            totalScore: 0,
            scoresByJudge: {},
            scoresByTestCase: {},
          };

          existing.totalScore += ranking.score;
          existing.scoresByJudge[judgment.judgeId] =
            (existing.scoresByJudge[judgment.judgeId] ?? 0) + ranking.score;
          existing.scoresByTestCase[matchup.testCaseId] =
            (existing.scoresByTestCase[matchup.testCaseId] ?? 0) +
            ranking.score;

          modelScores.set(ranking.modelId, existing);
        }
      }
    }

    // Build leaderboard entries
    const entries: BattleLeaderboardEntry[] = [];

    for (const [modelId, scores] of modelScores) {
      const model = getModelById(modelId);
      if (!model) continue;

      const outputs = allOutputs.get(modelId);
      const numOutputs = outputs?.outputs.length ?? 0;

      let averageDuration = 0;
      let averageCost = 0;

      if (numOutputs > 0 && outputs) {
        const totalDurationMs = outputs.outputs.reduce(
          (sum, o) => sum + o.duration,
          0,
        );
        averageDuration = totalDurationMs / numOutputs / MS_TO_SECONDS;

        const avgInputTokens =
          outputs.outputs.reduce((sum, o) => sum + o.inputTokens, 0) /
          numOutputs;
        const avgOutputTokens =
          outputs.outputs.reduce((sum, o) => sum + o.outputTokens, 0) /
          numOutputs;

        averageCost = calculateCost(
          avgInputTokens,
          avgOutputTokens,
          model.inputCost,
          model.outputCost,
        );
      }

      entries.push({
        averageCost,
        averageDuration,
        averageScore:
          totalJudgments > 0 ? scores.totalScore / matchups.length : 0,
        modelId,
        modelName: getModelDisplayName(model),
        provider: modelId.split("/")[0] ?? modelId,
        scoresByJudge: scores.scoresByJudge,
        scoresByTestCase: scores.scoresByTestCase,
        totalScore: scores.totalScore,
      });
    }

    return entries.sort((a, b) => b.totalScore - a.totalScore);
  },
);
