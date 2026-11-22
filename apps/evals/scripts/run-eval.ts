import { parseArgs } from "node:util";
import {
  type LanguageSummary,
  REQUIRED_LANGUAGES,
  formatLanguageResults,
  getTestCaseLanguage,
  summarizeByLanguage,
} from "@/lib/case-languages";
import { getCallsCost } from "@/lib/cost";
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
import { removeModelOutputRuns } from "@/lib/output-loader";
import {
  getMeteredCalls,
  isPricedFromOutputs,
  meterModelCalls,
  meterWork,
  recordCalls,
} from "@/lib/spend-meter";
import { type TaskStats, getSpent, getStatsFromResults } from "@/lib/stats";
import { getTestCaseRunIds } from "@/lib/test-case-runs";
import { type RegisteredTask, type TaskEvalResults, type TestCase } from "@/lib/types";
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

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      case: { multiple: true, type: "string" },
      fresh: { default: false, type: "boolean" },
      language: { multiple: true, type: "string" },
      limit: { type: "string" },
      model: { multiple: true, type: "string" },
      runs: { type: "string" },
      saved: { default: false, type: "boolean" },
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

  const runs = values.runs === undefined ? RUNS_PER_TEST_CASE : Number(values.runs);

  if (!Number.isInteger(runs) || runs < 1) {
    fail(`--runs takes a whole number from 1: ${values.runs}`);
  }

  return {
    caseIds: values.case ?? [],
    fresh: values.fresh,
    languages: values.language ?? [],
    limit: values.limit ? Number(values.limit) : undefined,
    modelIds,
    runs,
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
}) {
  const model = getModelById(modelId) ?? fail(`Unknown model: ${modelId}`);
  const run = saved ? null : await generateAndScore({ fresh, model, prices, runIds, runs, task });

  const evalResults: TaskEvalResults = (await getTaskResults(task.id, modelId, runIds)) ?? {
    modelId,
    outputs: [],
    results: [],
    taskId: task.id,
  };

  return { evalResults, modelId, run };
}

function reportModel({
  evalResults,
  modelId,
  prices,
  run,
  sampled,
  task,
}: Awaited<ReturnType<typeof runModel>> & {
  prices: GatewayPrices;
  sampled: number;
  task: RegisteredTask;
}): ReportRow {
  const stats = getStatsFromResults({ evalResults, prices });

  return {
    languages: summarizeByLanguage({ results: evalResults.results, testCases: task.testCases }),
    meetsBudget: meetsLatencyBudget({
      budget: task.latencyBudget,
      latency: { p50: stats.latencyP50, p95: stats.latencyP95 },
    }),
    modelId,
    sampled,
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
    row.summary.averageScore?.toFixed(2) ?? "unscored",
    accuracy,
    formatKeyFlaws(row.summary),
    formatDollars(row.stats.costPer1000Runs),
    formatSeconds(row.stats.latencyP50),
    formatSeconds(row.stats.latencyP95),
    ...(hasBudget ? [formatLatencyVerdict(row.meetsBudget)] : []),
    `${row.summary.scored}/${row.sampled}`,
    row.summary.attempted,
    row.summary.generated,
    formatFailureCounts(row.summary),
    formatPerLabel(row.stats) || "—",
    ...formatLanguageResults(row.languages).map((result) => result.text),
    formatDollars(row.spent),
    row.summary.caseIds.attempted
      .map((caseId) => `[${caseId}](${getCaseHref({ caseId, modelId: row.modelId, taskId })})`)
      .join(", ") || "—",
  ].join(" | ");
}

function formatReport({ rows, task }: { rows: ReportRow[]; task: RegisteredTask }): string {
  // The columns that decide between models come first; how complete the run was follows.
  const headers = [
    "Model",
    "Kind",
    "Avg score (scored outputs)",
    "Accuracy",
    "Judge-flagged key flaws",
    "Cost / 1k runs",
    "p50",
    "p95",
    ...(task.latencyBudget ? ["Budget"] : []),
    "Scored / sampled",
    "Attempted (recorded)",
    "Generated",
    "Generation failures",
    "Per label (correct/total)",
    ...REQUIRED_LANGUAGES.map((language) => language.toUpperCase()),
    "Spent",
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

  const models = await modelIds.reduce<Promise<Awaited<ReturnType<typeof runModel>>[]>>(
    async (previous, modelId) => [
      ...(await previous),
      await runModel({ fresh, modelId, prices, runIds, runs, saved, task: sampledTask }),
    ],
    Promise.resolve([]),
  );

  if (task.id !== "language-audio") {
    return models.map((model) => reportModel({ ...model, prices, sampled: runIds.size, task }));
  }

  const shared = models.reduce(
    (cases, { evalResults }) =>
      cases.intersection(
        new Set(
          evalResults.results
            .filter((result) => !result.listeningReview)
            .map((result) => result.testCase.id),
        ),
      ),
    runIds,
  );

  process.stdout.write(`Language audio scores use ${shared.size} shared case runs.\n`);

  return models.map((model) => {
    const { evalResults } = model;
    const results = evalResults.results.filter((result) => shared.has(result.testCase.id));
    const needsListening = evalResults.results.filter((result) => result.listeningReview);

    process.stdout.write(`${model.modelId} · Needs a listen: ${needsListening.length}\n`);

    for (const result of evalResults.results) {
      const conclusion = result.listeningReview?.conclusion ?? result.steps[0]?.conclusion ?? "";

      if (conclusion.startsWith("Needs a listen:") || conclusion.startsWith("Confirmed misread:")) {
        process.stdout.write(`${model.modelId} · ${conclusion}\n`);
      } else if (result.classification?.predicted === "misread") {
        const { audioPath } = JSON.parse(result.output) as { audioPath: string };
        process.stdout.write(`${model.modelId} · Legacy flag: eval-results/audio/${audioPath}\n`);
      }
    }

    return reportModel({
      ...model,
      evalResults: {
        ...evalResults,
        failedRuns: evalResults.failedRuns?.filter((run) => shared.has(run.testCaseId)),
        outputs: evalResults.outputs.filter((output) => shared.has(output.testCaseId)),
        results,
      },
      prices,
      sampled: shared.size,
      task,
    });
  });
}

async function runEvals({
  caseIds,
  fresh,
  languages,
  limit,
  modelIds,
  runs,
  saved,
  tasks,
}: ReturnType<typeof parseCliArgs>) {
  const filters = { caseIds, languages };
  const prices = GATEWAY_PRICES;

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
