import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { resolveBattleMatchupModelIds } from "./battle-mapping";
import { estimateCostPer1000Runs, getCallCost } from "./cost";
import { type GatewayPrices, loadGatewayPrices } from "./gateway-prices";
import { summarizeLatency } from "./latency";
import { average, sum } from "./math";
import {
  type ModelConfig,
  canJudge,
  getModelById,
  getModelDisplayName,
  getModelFamily,
} from "./models";
import { getAllOutputsForTask } from "./output-loader";
import { summarizeCategoryScores } from "./score-categories";
import {
  type BattleLeaderboardEntry,
  type BattleMatchup,
  type CategoryScore,
  type ModelOutputs,
} from "./types";

const EVAL_RESULTS_DIR = path.join(process.cwd(), "eval-results");
const BATTLES_DIR = path.join(EVAL_RESULTS_DIR, "battles");

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
        return resolveBattleMatchupModelIds(JSON.parse(data) as BattleMatchup);
      }),
    );

    return matchups.toSorted((a, b) => a.testCaseId.localeCompare(b.testCaseId));
  } catch {
    return [];
  }
});

type ModelScores = {
  categoryScoreGroups: CategoryScore[][];
  scores: number[];
  scoresByJudge: Record<string, number[]>;
  scoresByTestCase: Record<string, number[]>;
};

type Ranking = BattleMatchup["judgments"][number]["rankings"][number];
type ScoredRanking = { judgeId: string; ranking: Ranking; testCaseId: string };

function averageEach(groups: Record<string, number[]>): Record<string, number> {
  return Object.fromEntries(Object.entries(groups).map(([key, values]) => [key, average(values)]));
}

/**
 * Flattens every judgment into rankings a judge was allowed to give. Older
 * battle files include judges scoring their own family; those are ignored so
 * historical leaderboards follow the same rule as new battles.
 */
function getEligibleRankings(matchups: BattleMatchup[]): ScoredRanking[] {
  return matchups.flatMap((matchup) =>
    matchup.judgments.flatMap((judgment) =>
      judgment.rankings
        .filter((ranking) => canJudge({ judgeId: judgment.judgeId, modelId: ranking.modelId }))
        .map((ranking) => ({ judgeId: judgment.judgeId, ranking, testCaseId: matchup.testCaseId })),
    ),
  );
}

/** Adds one judge's score for one test case to a model's running totals. */
function addRanking({
  scored: { judgeId, ranking, testCaseId },
  scores,
}: {
  scored: ScoredRanking;
  scores?: ModelScores;
}): ModelScores {
  const existing = scores ?? {
    categoryScoreGroups: [],
    scores: [],
    scoresByJudge: {},
    scoresByTestCase: {},
  };

  return {
    categoryScoreGroups: ranking.categoryScores
      ? [...existing.categoryScoreGroups, ranking.categoryScores]
      : existing.categoryScoreGroups,
    scores: [...existing.scores, ranking.score],
    scoresByJudge: {
      ...existing.scoresByJudge,
      [judgeId]: [...(existing.scoresByJudge[judgeId] ?? []), ranking.score],
    },
    scoresByTestCase: {
      ...existing.scoresByTestCase,
      [testCaseId]: [...(existing.scoresByTestCase[testCaseId] ?? []), ranking.score],
    },
  };
}

function aggregateScoresFromMatchups(matchups: BattleMatchup[]): Map<string, ModelScores> {
  return getEligibleRankings(matchups).reduce(
    (modelScores, scored) =>
      modelScores.set(
        scored.ranking.modelId,
        addRanking({ scored, scores: modelScores.get(scored.ranking.modelId) }),
      ),
    new Map<string, ModelScores>(),
  );
}

function calculateModelMetrics({
  model,
  outputs,
  prices,
}: {
  model: ModelConfig;
  outputs?: ModelOutputs;
  prices: GatewayPrices;
}): Pick<BattleLeaderboardEntry, "costPer1000Runs" | "latencyP50" | "latencyP95"> {
  const entries = outputs?.outputs ?? [];

  const costs = entries.map((output) =>
    getCallCost({ modelId: model.gatewayModelId, prices, usage: output }),
  );

  const latency = summarizeLatency(entries.map((output) => output.duration));

  return {
    costPer1000Runs: estimateCostPer1000Runs(costs),
    latencyP50: latency.p50,
    latencyP95: latency.p95,
  };
}

function buildLeaderboardEntry({
  allOutputs,
  modelId,
  prices,
  scores,
}: {
  allOutputs: Map<string, ModelOutputs>;
  modelId: string;
  prices: GatewayPrices;
  scores: ModelScores;
}): BattleLeaderboardEntry | null {
  const model = getModelById(modelId);

  if (!model) {
    return null;
  }

  return {
    ...calculateModelMetrics({ model, outputs: allOutputs.get(modelId), prices }),
    averageScore: average(scores.scores),
    categoryScores: summarizeCategoryScores(scores.categoryScoreGroups),
    modelId,
    modelName: getModelDisplayName(model),
    provider: getModelFamily(model),
    scoresByJudge: averageEach(scores.scoresByJudge),
    scoresByTestCase: averageEach(scores.scoresByTestCase),
  };
}

/** Total spent on battle judges for a task, from the usage saved with each judgment. */
export async function getBattleJudgeCost(taskId: string): Promise<number> {
  const [matchups, prices] = await Promise.all([getBattleMatchups(taskId), loadGatewayPrices()]);

  const judgeCosts = matchups
    .flatMap((matchup) => matchup.judgments)
    .map((judgment) =>
      judgment.usage
        ? getCallCost({ modelId: judgment.judgeId, prices, usage: judgment.usage })
        : 0,
    );

  return sum(judgeCosts);
}

export const getBattleLeaderboard = cache(
  async (taskId: string): Promise<BattleLeaderboardEntry[]> => {
    const [matchups, allOutputs, prices] = await Promise.all([
      getBattleMatchups(taskId),
      getAllOutputsForTask(taskId),
      loadGatewayPrices(),
    ]);

    if (matchups.length === 0) {
      return [];
    }

    const modelScores = aggregateScoresFromMatchups(matchups);

    const entries = [...modelScores.entries()].flatMap(([modelId, scores]) => {
      const entry = buildLeaderboardEntry({ allOutputs, modelId, prices, scores });
      return entry ? [entry] : [];
    });

    return entries.toSorted((a, b) => b.averageScore - a.averageScore);
  },
);
