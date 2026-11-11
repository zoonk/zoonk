import { parseArgs } from "node:util";
import { compareWithinJudges } from "@/lib/battle-head-to-head";
import { buildBattleLeaderboard, sumJudgeCost } from "@/lib/battle-loader";
import { formatBattleReport } from "@/lib/battle-report";
import { removeBattleMatchups, runBattleMode } from "@/lib/battle-runner";
import {
  type LanguageSummary,
  REQUIRED_LANGUAGES,
  formatLanguageResults,
  getTestCaseLanguage,
  summarizeByLanguage,
} from "@/lib/case-languages";
import { getCallsCost, getFailedRunsCost, getRunCost } from "@/lib/cost";
import { getTaskResults, removeModelResultRuns, runEval } from "@/lib/eval-runner";
import {
  type EvalSummary,
  HISTORICAL_ATTEMPTS_NOTE,
  aggregateEvalResults,
  formatFailureCounts,
  formatKeyFlaws,
  getCaseHref,
} from "@/lib/eval-summary";
import {
  formatDollars,
  formatLatencyBudget,
  formatLatencyVerdict,
  formatPercent,
  formatSeconds,
} from "@/lib/format";
import { meetsLatencyBudget } from "@/lib/latency";
import { type ModelConfig, getModelById, getModelDisplayName } from "@/lib/models";
import { generateOutputs } from "@/lib/output-generator";
import { getAllOutputsForTask, removeModelOutputRuns } from "@/lib/output-loader";
import {
  getMeteredCalls,
  isPricedFromOutputs,
  meterModelCalls,
  meterWork,
  recordCalls,
} from "@/lib/spend-meter";
import { type TaskStats, getSpent, getStatsFromResults } from "@/lib/stats";
import { getTestCaseRunIds } from "@/lib/test-case-runs";
import {
  type ModelOutputs,
  type RegisteredTask,
  type TaskEvalResults,
  type TestCase,
  supportsJudgeMode,
} from "@/lib/types";
import { RUNS_PER_TEST_CASE, getTaskById } from "@/tasks";
import { zoonkDefaultProvider } from "@zoonk/ai/gateway";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import { type GatewayPrices } from "@zoonk/ai/pricing/gateway-prices";

type ReportRow = {
  summary: EvalSummary;
  languages: LanguageSummary[];
  meetsBudget: boolean | null;
  modelId: string;
  sampled: number;
  spent: number;
  stats: TaskStats;
};

function fail(message: string): never {
  throw new Error(message);
}

/** Every check runs before anything is deleted, written or paid for. */
function validateBattle({ modelIds, tasks }: { modelIds: string[]; tasks: RegisteredTask[] }) {
  const ineligible = tasks.find((task) => !supportsJudgeMode(task));

  if (ineligible) {
    fail(
      `Task ${ineligible.id} can't battle: it needs judge expectations on every case, text outputs, and, with its own scorer, the code checks that scorer runs.`,
    );
  }

  if (modelIds.length < 2) {
    fail("A battle needs at least two --model.");
  }

  const notWriter = modelIds.find((modelId) => getModelById(modelId)?.kind !== "generation");

  if (notWriter) {
    fail(`Model ${notWriter} doesn't write outputs, so it can't battle.`);
  }
}

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      battle: { default: false, type: "boolean" },
      case: { multiple: true, type: "string" },
      fresh: { default: false, type: "boolean" },
      language: { multiple: true, type: "string" },
      limit: { type: "string" },
      model: { multiple: true, type: "string" },
      runs: { type: "string" },
      saved: { default: false, type: "boolean" },
      swap: { default: false, type: "boolean" },
      task: { multiple: true, type: "string" },
    },
  });

  const tasks = (values.task ?? []).map(
    (taskId) => getTaskById(taskId) ?? fail(`Unknown task: ${taskId}`),
  );

  const modelIds = values.model ?? [];
  const unknownModel = modelIds.find((modelId) => !getModelById(modelId));

  if (tasks.length === 0 || modelIds.length === 0 || unknownModel) {
    fail(
      `Pass at least one --task and one known --model.${unknownModel ? ` Unknown: ${unknownModel}` : ""}`,
    );
  }

  if (values.saved && values.fresh) {
    fail("Pass --saved or --fresh, not both: --saved reads results without calling any model.");
  }

  if (!values.battle && values.swap) {
    fail("--swap applies only to --battle.");
  }

  const runs = values.runs === undefined ? RUNS_PER_TEST_CASE : Number(values.runs);

  if (!Number.isInteger(runs) || runs < 1) {
    fail(`--runs takes a whole number from 1: ${values.runs}`);
  }

  if (values.battle) {
    validateBattle({ modelIds, tasks });
  }

  return {
    battle: values.battle,
    caseIds: values.case ?? [],
    fresh: values.fresh,
    languages: values.language ?? [],
    limit: values.limit ? Number(values.limit) : undefined,
    modelIds,
    runs,
    saved: values.saved,
    swapped: values.swap,
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

function getRunIds(testCases: TestCase[], runsPerTestCase: number): Set<string> {
  return new Set(getTestCaseRunIds({ runsPerTestCase, testCases }));
}

async function generateAndScore({
  fresh,
  model,
  prices,
  runIds,
  runs,
  task,
}: {
  fresh: boolean;
  model: ModelConfig;
  prices: GatewayPrices;
  runIds: Set<string>;
  runs: number;
  task: RegisteredTask;
}): Promise<{ spent: number }> {
  if (fresh) {
    await Promise.all([
      removeModelOutputRuns({ modelId: model.id, runIds, taskId: task.id }),
      removeModelResultRuns({ modelId: model.id, runIds, taskId: task.id }),
    ]);
  }

  const { calls } = await meterWork(async () => {
    const generated = await generateOutputs(task, model.id, { runsPerTestCase: runs });

    if (isPricedFromOutputs(model.kind)) {
      recordCalls(generated.map((usage) => ({ modelId: model.gatewayModelId, usage })));
    }

    return runEval(task, model.id, runIds);
  });

  return { spent: getCallsCost({ calls, prices }) };
}

async function runModel({
  fresh,
  modelId,
  prices,
  runIds,
  runs,
  saved,
  task,
}: {
  fresh: boolean;
  modelId: string;
  prices: GatewayPrices;
  runIds: Set<string>;
  runs: number;
  saved: boolean;
  task: RegisteredTask;
}): Promise<ReportRow> {
  const model = getModelById(modelId) ?? fail(`Unknown model: ${modelId}`);
  const run = saved ? null : await generateAndScore({ fresh, model, prices, runIds, runs, task });

  const evalResults: TaskEvalResults = (await getTaskResults(task.id, modelId, runIds)) ?? {
    modelId,
    outputs: [],
    results: [],
    taskId: task.id,
  };

  const stats = getStatsFromResults({ evalResults, prices });

  return {
    languages: summarizeByLanguage({ results: evalResults.results, testCases: task.testCases }),
    meetsBudget: meetsLatencyBudget({
      budget: task.latencyBudget,
      latency: { p50: stats.latencyP50, p95: stats.latencyP95 },
    }),
    modelId,
    sampled: runIds.size,
    spent: run?.spent ?? getSpent(stats),
    stats,
    summary: aggregateEvalResults(evalResults),
  };
}

function formatPerLabel(stats: TaskStats): string {
  return (stats.classification?.perLabel ?? [])
    .map((item) => `${item.label} ${item.correct}/${item.total}`)
    .join(", ");
}

function formatRow({
  hasBudget,
  row,
  taskId,
}: {
  hasBudget: boolean;
  row: ReportRow;
  taskId: string;
}): string {
  const model = getModelById(row.modelId);

  const accuracy = row.stats.classification
    ? formatPercent(row.stats.classification.accuracy)
    : "—";

  return [
    model ? getModelDisplayName(model) : row.modelId,
    model?.kind ?? "",
    `${row.summary.scored}/${row.sampled}`,
    row.summary.attempted,
    row.summary.generated,
    formatFailureCounts(row.summary),
    formatKeyFlaws(row.summary),
    row.summary.averageScore?.toFixed(2) ?? "unscored",
    accuracy,
    formatPerLabel(row.stats) || "—",
    ...formatLanguageResults(row.languages).map((result) => result.text),
    formatSeconds(row.stats.latencyP50),
    formatSeconds(row.stats.latencyP95),
    ...(hasBudget ? [formatLatencyVerdict(row.meetsBudget)] : []),
    formatDollars(row.spent),
    formatDollars(row.stats.costPer1000Runs),
    row.summary.caseIds.attempted
      .map((caseId) => `[${caseId}](${getCaseHref({ caseId, modelId: row.modelId, taskId })})`)
      .join(", ") || "—",
  ].join(" | ");
}

function formatReport({ rows, task }: { rows: ReportRow[]; task: RegisteredTask }): string {
  const headers = [
    "Model",
    "Kind",
    "Scored / sampled",
    "Attempted (recorded)",
    "Generated",
    "Generation failures",
    "Judge-flagged key flaws",
    "Avg score (scored outputs)",
    "Accuracy",
    "Per label (correct/total)",
    ...REQUIRED_LANGUAGES.map((language) => language.toUpperCase()),
    "p50",
    "p95",
    ...(task.latencyBudget ? ["Budget"] : []),
    "Spent",
    "Cost / 1k runs",
    "Case links",
  ];

  return [
    `\n### ${task.name} (${task.id})\n`,
    HISTORICAL_ATTEMPTS_NOTE,
    ...(task.latencyBudget ? [`Latency budget: ${formatLatencyBudget(task.latencyBudget)}\n`] : []),
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map(
      (row) => `| ${formatRow({ hasBudget: Boolean(task.latencyBudget), row, taskId: task.id })} |`,
    ),
  ].join("\n");
}

async function runTask({
  filters,
  fresh,
  limit,
  modelIds,
  prices,
  runs,
  saved,
  task,
}: {
  filters: CaseFilters;
  fresh: boolean;
  limit?: number;
  modelIds: string[];
  prices: GatewayPrices;
  runs: number;
  saved: boolean;
  task: RegisteredTask;
}): Promise<ReportRow[]> {
  const sampledTask = {
    ...task,
    testCases: sampleTestCases({ filters, limit, testCases: task.testCases }),
  };

  const runIds = getRunIds(sampledTask.testCases, runs);

  return modelIds.reduce<Promise<ReportRow[]>>(
    async (previousRows, modelId) => [
      ...(await previousRows),
      await runModel({ fresh, modelId, prices, runIds, runs, saved, task: sampledTask }),
    ],
    Promise.resolve([]),
  );
}

function onlyRuns({
  modelIds,
  outputs,
  runIds,
}: {
  modelIds: string[];
  outputs: Map<string, ModelOutputs>;
  runIds: Set<string>;
}): Map<string, ModelOutputs> {
  return new Map(
    modelIds.flatMap((modelId): [string, ModelOutputs][] => {
      const modelOutputs = outputs.get(modelId);

      return modelOutputs
        ? [
            [
              modelId,
              {
                ...modelOutputs,
                failedRuns: modelOutputs.failedRuns?.filter((run) => runIds.has(run.testCaseId)),
                outputs: modelOutputs.outputs.filter((output) => runIds.has(output.testCaseId)),
              },
            ],
          ]
        : [];
    }),
  );
}

/**
 * Writes the sampled cases with every model (`runs` times each), then has one judge per family rank
 * them, each judge skipping its own family's models, instead of scoring each output with the single
 * judge. With `saved`, it reports saved outputs and judgments without calling any model.
 */
async function runBattle({
  filters,
  fresh,
  limit,
  modelIds,
  runs,
  saved,
  swapped,
  task,
}: {
  filters: CaseFilters;
  fresh: boolean;
  limit?: number;
  modelIds: string[];
  runs: number;
  saved: boolean;
  swapped: boolean;
  task: RegisteredTask;
}): Promise<{ report: string; spent: number }> {
  const sampledTask = {
    ...task,
    testCases: sampleTestCases({ filters, limit, testCases: task.testCases }),
  };

  const runIds = getRunIds(sampledTask.testCases, runs);

  if (fresh) {
    await Promise.all([
      removeBattleMatchups({ taskId: task.id, testCaseIds: [...runIds] }),
      ...modelIds.map((modelId) => removeModelOutputRuns({ modelId, runIds, taskId: task.id })),
    ]);
  }

  const writing = await meterWork(async () => {
    if (!saved) {
      await Promise.all(
        modelIds.map((modelId) => generateOutputs(sampledTask, modelId, { runsPerTestCase: runs })),
      );
    }
  });

  const judging = await meterWork(() =>
    runBattleMode(sampledTask, { modelIds, runsPerTestCase: runs, saved, swapped }),
  );

  const { matchups, unjudged } = judging.result;
  const outputs = onlyRuns({ modelIds, outputs: await getAllOutputsForTask(task.id), runIds });

  const costOf = (modelId: string) => {
    const model = getModelById(modelId) ?? fail(`Unknown model: ${modelId}`);
    const modelOutputs = outputs.get(modelId);

    return (modelOutputs?.outputs ?? []).reduce(
      (total, run) => total + getRunCost({ model, prices: GATEWAY_PRICES, run }),
      getFailedRunsCost({ failedRuns: modelOutputs?.failedRuns, prices: GATEWAY_PRICES }),
    );
  };

  const generationSpent = saved
    ? modelIds.reduce((total, modelId) => total + costOf(modelId), 0)
    : getCallsCost({ calls: writing.calls, prices: GATEWAY_PRICES });

  const judgeSpent = saved
    ? sumJudgeCost(matchups)
    : getCallsCost({ calls: judging.calls, prices: GATEWAY_PRICES });

  const report = formatBattleReport({
    caseRuns: runIds.size,
    cost: costOf,
    failed: (modelId) => runIds.size - (outputs.get(modelId)?.outputs.length ?? 0),
    generationSpent,
    headToHead: compareWithinJudges(matchups),
    judgeSpent,
    leaderboard: buildBattleLeaderboard({ allOutputs: outputs, matchups }),
    saved,
    task,
    unjudged,
  });

  return { report, spent: generationSpent + judgeSpent };
}

async function runEvals({
  battle,
  caseIds,
  fresh,
  languages,
  limit,
  modelIds,
  runs,
  saved,
  swapped,
  tasks,
}: ReturnType<typeof parseCliArgs>) {
  const filters = { caseIds, languages };
  const prices = GATEWAY_PRICES;

  if (battle) {
    const battles = await tasks.reduce<Promise<{ report: string; spent: number }[]>>(
      async (previous, task) => [
        ...(await previous),
        await runBattle({ filters, fresh, limit, modelIds, runs, saved, swapped, task }),
      ],
      Promise.resolve([]),
    );

    const spent = battles.reduce((total, result) => total + result.spent, 0);

    process.stdout.write(
      `${battles.map((result) => result.report).join("\n")}\n\n${saved ? "Saved runs cost" : "Total spent"}: ${formatDollars(spent)}.\n`,
    );

    return;
  }

  const reports = await tasks.reduce<Promise<{ rows: ReportRow[]; task: RegisteredTask }[]>>(
    async (previous, task) => [
      ...(await previous),
      { rows: await runTask({ filters, fresh, limit, modelIds, prices, runs, saved, task }), task },
    ],
    Promise.resolve([]),
  );

  const totalSpent = reports
    .flatMap((report) => report.rows)
    .reduce((total, row) => total + row.spent, 0);

  const output = [
    ...reports.map((report) => formatReport(report)),
    `\nPrices from the gateway list saved at ${prices.fetchedAt}. ${saved ? "Saved runs cost" : "Total spent"}: ${formatDollars(totalSpent)}.`,
  ].join("\n");

  process.stdout.write(`${output}\n`);
}

async function main() {
  globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;
  meterModelCalls();
  const args = parseCliArgs();

  try {
    await runEvals(args);
  } catch (error) {
    const spent = getCallsCost({ calls: getMeteredCalls(), prices: GATEWAY_PRICES });
    process.stdout.write(`\nThe run failed after ${formatDollars(spent)} of model calls.\n`);
    throw error;
  }
}

await main();
