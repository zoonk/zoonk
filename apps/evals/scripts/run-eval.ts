/**
 * Runs tasks for several models from the command line and prints one
 * comparison table per task. Outputs and scores are saved in eval-results
 * exactly like runs started from the dashboard.
 *
 *   pnpm eval:run --task course-intent --model typesafe-ai/jev \
 *     --model openai/gpt-6-luna --limit 30 --fresh
 *
 * --limit samples that many cases per task, spread evenly across expected
 * labels and languages. --fresh regenerates the sampled cases even when saved
 * outputs exist, so latency is measured the same way for every model in the
 * table. Each table shows English and Portuguese apart, and whether each model
 * meets the task's latency budget. --language keeps only cases in those
 * languages, and --case only cases whose id contains one of the given texts.
 * --saved prints the same table from saved results without calling any model.
 */
import { parseArgs } from "node:util";
import {
  type LanguageSummary,
  REQUIRED_LANGUAGES,
  formatLanguageResults,
  getTestCaseLanguage,
  summarizeByLanguage,
} from "@/lib/case-languages";
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
import { removeModelOutputRuns } from "@/lib/output-loader";
import { type TaskStats, getStatsFromResults } from "@/lib/stats";
import { getTestCaseRunId } from "@/lib/test-case-runs";
import { type RegisteredTask, type TaskEvalResults, type TestCase } from "@/lib/types";
import { RUNS_PER_TEST_CASE, getTaskById } from "@/tasks";
import { zoonkDefaultProvider } from "@zoonk/ai/gateway";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import { type GatewayPrices } from "@zoonk/ai/pricing/gateway-prices";

/** `scored` below `sampled` means calls failed or timed out; accuracy only covers scored cases. */
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
    caseIds: values.case ?? [],
    fresh: values.fresh,
    languages: values.language ?? [],
    limit: values.limit ? Number(values.limit) : undefined,
    modelIds,
    saved: values.saved,
    tasks,
  };
}

/**
 * Interleaves cases by expected value and language so a small sample still
 * covers every label in English and Portuguese instead of the first cases in
 * file order.
 */
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
    formatDollars(row.stats.runCost + row.stats.judgeCost),
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

/**
 * Models run one after another so each model's latency is measured without
 * another model's requests competing for the same connections.
 */
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

async function main() {
  // The same provider the apps register, so task runs and judges cache their system prompts too.
  globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;
  const { caseIds, fresh, languages, limit, modelIds, saved, tasks } = parseCliArgs();
  const filters = { caseIds, languages };
  const prices = GATEWAY_PRICES;

  const reports = await tasks.reduce<Promise<{ rows: ReportRow[]; task: RegisteredTask }[]>>(
    async (previous, task) => [
      ...(await previous),
      { rows: await runTask({ filters, fresh, limit, modelIds, prices, saved, task }), task },
    ],
    Promise.resolve([]),
  );

  const totalSpent = reports
    .flatMap((report) => report.rows)
    .reduce((total, row) => total + row.stats.runCost + row.stats.judgeCost, 0);

  const output = [
    ...reports.map((report) => formatReport(report)),
    `\nPrices from the gateway list saved at ${prices.fetchedAt}. ${saved ? "Saved runs cost" : "Total spent"}: ${formatDollars(totalSpent)}.`,
  ].join("\n");

  process.stdout.write(`${output}\n`);
}

await main();
