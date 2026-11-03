import { parseArgs } from "node:util";
import { buildBattleLeaderboard, sumJudgeCost } from "@/lib/battle-loader";
import { BATTLE_JUDGES, removeBattleMatchups, runBattleMode } from "@/lib/battle-runner";
import {
  type LanguageSummary,
  REQUIRED_LANGUAGES,
  formatLanguageResults,
  getTestCaseLanguage,
  summarizeByLanguage,
} from "@/lib/case-languages";
import { getCallCost } from "@/lib/cost";
import { getTaskResults, removeModelResultRuns, runEval } from "@/lib/eval-runner";
import {
  formatDollars,
  formatLatencyBudget,
  formatLatencyVerdict,
  formatPercent,
  formatSeconds,
} from "@/lib/format";
import { meetsLatencyBudget } from "@/lib/latency";
import { calculateAverageScore } from "@/lib/leaderboard";
import { getModelById, getModelDisplayName } from "@/lib/models";
import { generateOutputs } from "@/lib/output-generator";
import { getAllOutputsForTask, removeModelOutputRuns } from "@/lib/output-loader";
import { type TaskStats, getSpent, getStatsFromResults } from "@/lib/stats";
import { getTestCaseRunId } from "@/lib/test-case-runs";
import {
  type BattleLeaderboardEntry,
  type RegisteredTask,
  type TaskEvalResults,
  type TestCase,
} from "@/lib/types";
import { RUNS_PER_TEST_CASE, getTaskById } from "@/tasks";
import { zoonkDefaultProvider } from "@zoonk/ai/gateway";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import { type GatewayPrices } from "@zoonk/ai/pricing/gateway-prices";

type ReportRow = {
  averageScore: number;
  languages: LanguageSummary[];
  meetsBudget: boolean | null;
  modelId: string;
  sampled: number;
  scored: number;
  stats: TaskStats;
};

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      battle: { default: false, type: "boolean" },
      case: { multiple: true, type: "string" },
      fresh: { default: false, type: "boolean" },
      language: { multiple: true, type: "string" },
      limit: { type: "string" },
      model: { multiple: true, type: "string" },
      saved: { default: false, type: "boolean" },
      task: { multiple: true, type: "string" },
    },
  });

  const tasks = (values.task ?? []).map((taskId) => {
    const task = getTaskById(taskId);

    if (!task) {
      throw new Error(`Unknown task: ${taskId}`);
    }

    return task;
  });

  const modelIds = values.model ?? [];
  const unknownModel = modelIds.find((modelId) => !getModelById(modelId));

  if (tasks.length === 0 || modelIds.length === 0 || unknownModel) {
    throw new Error(
      `Pass at least one --task and one known --model.${unknownModel ? ` Unknown: ${unknownModel}` : ""}`,
    );
  }

  return {
    battle: values.battle,
    caseIds: values.case ?? [],
    fresh: values.fresh,
    languages: values.language ?? [],
    limit: values.limit ? Number(values.limit) : undefined,
    modelIds,
    saved: values.saved,
    tasks,
  };
}

type CaseFilters = { caseIds: string[]; languages: string[] };

function matchesFilters({ caseIds, languages }: CaseFilters, testCase: TestCase): boolean {
  const matchesLanguage =
    languages.length === 0 || languages.includes(getTestCaseLanguage(testCase) ?? "");

  const matchesId = caseIds.length === 0 || caseIds.some((text) => testCase.id.includes(text));

  return matchesLanguage && matchesId;
}

function sampleTestCases({
  filters,
  limit,
  testCases,
}: {
  filters: CaseFilters;
  limit?: number;
  testCases: TestCase[];
}): TestCase[] {
  const filtered = testCases.filter((testCase) => matchesFilters(filters, testCase));

  if (!limit || limit >= filtered.length) {
    return filtered;
  }

  const groups = Map.groupBy(filtered, (testCase) =>
    JSON.stringify([testCase.expected ?? null, getTestCaseLanguage(testCase)]),
  );

  const groupList = [...groups.values()];
  const largestGroup = Math.max(...groupList.map((group) => group.length));

  return Array.from({ length: largestGroup }, (_, index) =>
    groupList.flatMap((group) => group.slice(index, index + 1)),
  )
    .flat()
    .slice(0, limit);
}

function getRunIds(testCases: TestCase[]): Set<string> {
  return new Set(
    testCases.flatMap((testCase) =>
      Array.from({ length: RUNS_PER_TEST_CASE }, (_, index) =>
        getTestCaseRunId({ runNumber: index + 1, testCaseId: testCase.id }),
      ),
    ),
  );
}

async function generateAndScore({
  fresh,
  modelId,
  runIds,
  task,
}: {
  fresh: boolean;
  modelId: string;
  runIds: Set<string>;
  task: RegisteredTask;
}): Promise<TaskEvalResults> {
  if (fresh) {
    await Promise.all([
      removeModelOutputRuns({ modelId, runIds, taskId: task.id }),
      removeModelResultRuns({ modelId, runIds, taskId: task.id }),
    ]);
  }

  await generateOutputs(task, modelId);
  return runEval(task, modelId);
}

async function runModel({
  fresh,
  modelId,
  prices,
  runIds,
  saved,
  task,
}: {
  fresh: boolean;
  modelId: string;
  prices: GatewayPrices;
  runIds: Set<string>;
  saved: boolean;
  task: RegisteredTask;
}): Promise<ReportRow> {
  const allResults = saved
    ? ((await getTaskResults(task.id, modelId)) ?? { modelId, results: [], taskId: task.id })
    : await generateAndScore({ fresh, modelId, runIds, task });

  const evalResults: TaskEvalResults = {
    ...allResults,
    results: allResults.results.filter((result) => runIds.has(result.testCase.id)),
  };

  const stats = getStatsFromResults({ evalResults, prices });

  return {
    averageScore: calculateAverageScore(evalResults),
    languages: summarizeByLanguage({ results: evalResults.results, testCases: task.testCases }),
    meetsBudget:
      evalResults.results.length === 0
        ? null
        : meetsLatencyBudget({
            budget: task.latencyBudget,
            latency: { p50: stats.latencyP50, p95: stats.latencyP95 },
          }),
    modelId,
    sampled: runIds.size,
    scored: evalResults.results.length,
    stats,
  };
}

function formatPerLabel(stats: TaskStats): string {
  return (stats.classification?.perLabel ?? [])
    .map((item) => `${item.label} ${item.correct}/${item.total}`)
    .join(", ");
}

function formatRow({ hasBudget, row }: { hasBudget: boolean; row: ReportRow }): string {
  const model = getModelById(row.modelId);

  const accuracy = row.stats.classification
    ? formatPercent(row.stats.classification.accuracy)
    : "—";

  return [
    model ? getModelDisplayName(model) : row.modelId,
    model?.kind ?? "",
    `${row.scored}/${row.sampled}`,
    accuracy,
    formatPerLabel(row.stats) || row.averageScore.toFixed(2),
    ...formatLanguageResults(row.languages).map((result) => result.text),
    formatSeconds(row.stats.latencyP50),
    formatSeconds(row.stats.latencyP95),
    ...(hasBudget ? [formatLatencyVerdict(row.meetsBudget)] : []),
    formatDollars(getSpent(row.stats)),
    formatDollars(row.stats.costPer1000Runs),
  ].join(" | ");
}

function formatReport({ rows, task }: { rows: ReportRow[]; task: RegisteredTask }): string {
  const headers = [
    "Model",
    "Kind",
    "Cases",
    "Accuracy",
    "Per label (correct/total)",
    ...REQUIRED_LANGUAGES.map((language) => language.toUpperCase()),
    "p50",
    "p95",
    ...(task.latencyBudget ? ["Budget"] : []),
    "Spent",
    "Cost / 1k runs",
  ];

  return [
    `\n### ${task.name} (${task.id})\n`,
    ...(task.latencyBudget ? [`Latency budget: ${formatLatencyBudget(task.latencyBudget)}\n`] : []),
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${formatRow({ hasBudget: Boolean(task.latencyBudget), row })} |`),
  ].join("\n");
}

async function runTask({
  filters,
  fresh,
  limit,
  modelIds,
  prices,
  saved,
  task,
}: {
  filters: CaseFilters;
  fresh: boolean;
  limit?: number;
  modelIds: string[];
  prices: GatewayPrices;
  saved: boolean;
  task: RegisteredTask;
}): Promise<ReportRow[]> {
  const sampledTask = {
    ...task,
    testCases: sampleTestCases({ filters, limit, testCases: task.testCases }),
  };

  const runIds = getRunIds(sampledTask.testCases);

  return modelIds.reduce<Promise<ReportRow[]>>(
    async (previousRows, modelId) => [
      ...(await previousRows),
      await runModel({ fresh, modelId, prices, runIds, saved, task: sampledTask }),
    ],
    Promise.resolve([]),
  );
}

function formatBattleRow({
  entry,
  failed,
  spent,
}: {
  entry: BattleLeaderboardEntry;
  failed: number;
  spent: number;
}): string {
  const judges = BATTLE_JUDGES.map((judgeId) => entry.scoresByJudge[judgeId]?.toFixed(2) ?? "—");
  const categories = entry.categoryScores.map((category) => category.score.toFixed(1));

  return [
    entry.modelName,
    entry.averageScore.toFixed(2),
    ...judges,
    ...categories,
    String(failed),
    formatSeconds(entry.latencyP50),
    formatDollars(spent),
  ].join(" | ");
}

/**
 * Writes the sampled cases with every model, then has one judge per family rank them, each judge
 * skipping its own family's models, instead of scoring each output with the single judge.
 */
async function runBattle({
  filters,
  fresh,
  limit,
  modelIds,
  task,
}: {
  filters: CaseFilters;
  fresh: boolean;
  limit?: number;
  modelIds: string[];
  task: RegisteredTask;
}): Promise<{ report: string; spent: number }> {
  const sampledTask = {
    ...task,
    testCases: sampleTestCases({ filters, limit, testCases: task.testCases }),
  };

  const runIds = getRunIds(sampledTask.testCases);

  if (fresh) {
    await Promise.all([
      removeBattleMatchups({ taskId: task.id, testCaseIds: [...runIds] }),
      ...modelIds.map((modelId) => removeModelOutputRuns({ modelId, runIds, taskId: task.id })),
    ]);
  }

  const outputs = await Promise.all(
    modelIds.map((modelId) => generateOutputs(sampledTask, modelId)),
  );

  const matchups = await runBattleMode(sampledTask, { modelIds });
  const allOutputs = await getAllOutputsForTask(task.id);
  const leaderboard = buildBattleLeaderboard({ allOutputs, matchups });

  const runOutputs = new Map(
    outputs.map((modelOutputs) => [
      modelOutputs.modelId,
      modelOutputs.outputs.filter((output) => runIds.has(output.testCaseId)),
    ]),
  );

  const generationSpent = (modelId: string) =>
    (runOutputs.get(modelId) ?? []).reduce(
      (total, usage) => total + getCallCost({ modelId, prices: GATEWAY_PRICES, usage }),
      0,
    );

  const judgeSpent = sumJudgeCost(matchups);
  const totalGeneration = modelIds.reduce((total, modelId) => total + generationSpent(modelId), 0);
  const categoryLabels = (task.scoreCategories ?? []).map((category) => category.label);

  const headers = [
    "Model",
    "Average",
    ...BATTLE_JUDGES.map((judgeId) => `by ${judgeId.split("/")[1]}`),
    ...categoryLabels,
    "Failed",
    "p50",
    "Spent",
  ];

  const report = [
    `\n### ${task.name} (${task.id}), battle on ${runIds.size} cases\n`,
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...leaderboard.map(
      (entry) =>
        `| ${formatBattleRow({
          entry,
          failed: runIds.size - (runOutputs.get(entry.modelId)?.length ?? 0),
          spent: generationSpent(entry.modelId),
        })} |`,
    ),
    `\nWriting: ${formatDollars(totalGeneration)}. Judges: ${formatDollars(judgeSpent)}.`,
  ].join("\n");

  return { report, spent: totalGeneration + judgeSpent };
}

async function main() {
  globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;
  const { battle, caseIds, fresh, languages, limit, modelIds, saved, tasks } = parseCliArgs();
  const filters = { caseIds, languages };
  const prices = GATEWAY_PRICES;

  if (battle) {
    const battles = await tasks.reduce<Promise<{ report: string; spent: number }[]>>(
      async (previous, task) => [
        ...(await previous),
        await runBattle({ filters, fresh, limit, modelIds, task }),
      ],
      Promise.resolve([]),
    );

    const spent = battles.reduce((total, result) => total + result.spent, 0);

    process.stdout.write(
      `${battles.map((result) => result.report).join("\n")}\n\nTotal spent: ${formatDollars(spent)}.\n`,
    );

    return;
  }

  const reports = await tasks.reduce<Promise<{ rows: ReportRow[]; task: RegisteredTask }[]>>(
    async (previous, task) => [
      ...(await previous),
      { rows: await runTask({ filters, fresh, limit, modelIds, prices, saved, task }), task },
    ],
    Promise.resolve([]),
  );

  const totalSpent = reports
    .flatMap((report) => report.rows)
    .reduce((total, row) => total + getSpent(row.stats), 0);

  const output = [
    ...reports.map((report) => formatReport(report)),
    `\nPrices from the gateway list saved at ${prices.fetchedAt}. ${saved ? "Saved runs cost" : "Total spent"}: ${formatDollars(totalSpent)}.`,
  ].join("\n");

  process.stdout.write(`${output}\n`);
}

await main();
