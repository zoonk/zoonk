import { type HeadToHead } from "./battle-head-to-head";
import { BATTLE_JUDGES } from "./battle-runner";
import { formatDollars, formatSeconds } from "./format";
import { getModelById, getModelDisplayName } from "./models";
import { type BattleLeaderboardEntry, type RegisteredTask } from "./types";

function modelName(modelId: string): string {
  const model = getModelById(modelId);
  return model ? getModelDisplayName(model) : modelId;
}

function judgeName(judgeId: string): string {
  return judgeId.split("/")[1] ?? judgeId;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function table(headers: string[], rows: string[][]): string[] {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ];
}

function formatCodeChecks(entry: BattleLeaderboardEntry): string {
  const checks = entry.codeChecks;
  return checks ? `${checks.passed}/${checks.total} parts, ${checks.problems} problems` : "—";
}

function leaderboardTable({
  cost,
  failed,
  leaderboard,
  task,
}: {
  cost: (modelId: string) => number;
  failed: (modelId: string) => number;
  leaderboard: BattleLeaderboardEntry[];
  task: RegisteredTask;
}): string[] {
  const categories = task.scoreCategories ?? [];
  const hasCodeChecks = leaderboard.some((entry) => entry.codeChecks);

  return table(
    [
      "Model",
      "Average",
      ...BATTLE_JUDGES.map((judgeId) => `by ${judgeName(judgeId)}`),
      ...categories.map((category) => category.label),
      ...(hasCodeChecks ? ["Code checks"] : []),
      "Failed",
      "p50",
      "Cost",
    ],
    leaderboard.map((entry) => [
      entry.modelName,
      entry.averageScore.toFixed(2),
      ...BATTLE_JUDGES.map((judgeId) => entry.scoresByJudge[judgeId]?.toFixed(2) ?? "—"),
      ...categories.map(
        (category) =>
          entry.categoryScores
            .find((score) => score.categoryId === category.id)
            ?.score.toFixed(1) ?? "—",
      ),
      ...(hasCodeChecks ? [formatCodeChecks(entry)] : []),
      String(failed(entry.modelId)),
      formatSeconds(entry.latencyP50),
      formatDollars(cost(entry.modelId)),
    ]),
  );
}

function headToHeadTable({
  headToHead,
  task,
}: {
  headToHead: HeadToHead[];
  task: RegisteredTask;
}): string[] {
  const categories = task.scoreCategories ?? [];

  return table(
    [
      "Judge",
      "First vs second",
      "Wins / ties / losses",
      "Difference",
      "±95%",
      ...categories.map((category) => `Δ ${category.label}`),
      "Cases",
    ],
    headToHead
      .toSorted((a, b) => a.judgeId.localeCompare(b.judgeId) || a.first.localeCompare(b.first))
      .map((pair) => [
        judgeName(pair.judgeId),
        `${modelName(pair.first)} vs ${modelName(pair.second)}`,
        `${pair.wins} / ${pair.ties} / ${pair.losses}`,
        signed(pair.meanDifference),
        pair.margin === null ? "—" : pair.margin.toFixed(2),
        ...categories.map((category) => {
          const difference = pair.categoryDifferences[category.id];
          return difference === undefined ? "—" : signed(difference);
        }),
        String(pair.cases),
      ]),
  );
}

export function formatBattleReport(params: {
  caseRuns: number;
  cost: (modelId: string) => number;
  failed: (modelId: string) => number;
  generationSpent: number;
  headToHead: HeadToHead[];
  judgeSpent: number;
  leaderboard: BattleLeaderboardEntry[];
  saved: boolean;
  task: RegisteredTask;
  unjudged: string[];
}): string {
  const { task, unjudged } = params;

  return [
    `\n### ${task.name} (${task.id}), battle on ${params.caseRuns} case-runs${params.saved ? " (saved)" : ""}\n`,
    ...leaderboardTable(params),
    "\nHead to head, inside each judge's panel (first minus second; a case's runs averaged first):\n",
    ...headToHeadTable(params),
    ...(unjudged.length > 0
      ? [`\nNo saved judgment for these outputs and models: ${unjudged.join(", ")}.`]
      : []),
    `\nWriting: ${formatDollars(params.generationSpent)}. Judges: ${formatDollars(params.judgeSpent)}.`,
  ].join("\n");
}
