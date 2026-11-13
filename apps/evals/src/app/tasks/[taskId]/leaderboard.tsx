"use client";

import { CaseCount, FailureCounts, KeyFlawCount } from "@/components/eval-counts";
import { REQUIRED_LANGUAGES, formatLanguageResults } from "@/lib/case-languages";
import { FAILURE_REASONS, HISTORICAL_ATTEMPTS_NOTE } from "@/lib/eval-summary";
import { formatDollars, formatLatencyVerdict, formatPercent, formatSeconds } from "@/lib/format";
import { type LeaderboardEntry } from "@/lib/leaderboard";
import { cn } from "@zoonk/ui/lib/utils";
import { LeaderboardExport } from "./leaderboard-export";
import { type LeaderboardColumn, LeaderboardTable, ModelLink } from "./leaderboard-table";

type Column = LeaderboardColumn<LeaderboardEntry>;

/** How much of the task a model's score rests on; "Failed runs" under "More columns" says why. */
function CasesScored({ entry, totalRuns }: { entry: LeaderboardEntry; totalRuns: number }) {
  const failed = FAILURE_REASONS.reduce(
    (total, reason) => total + entry.summary.failures[reason].count,
    0,
  );

  return (
    <span
      className={cn(failed > 0 && "text-destructive-text")}
      title={failed > 0 ? `${failed} ${failed === 1 ? "run" : "runs"} failed` : undefined}
    >
      {entry.summary.scored}/{totalRuns}
    </span>
  );
}

/** A column that only some tasks have shows when some model has a value for it. */
function shownWhen(isShown: boolean, column: Column): Column[] {
  return isShown ? [column] : [];
}

function getColumns({
  entries,
  taskId,
  totalRuns,
}: {
  entries: LeaderboardEntry[];
  taskId: string;
  totalRuns: number;
}): Column[] {
  return [
    {
      cell: (entry) => (
        <ModelLink modelId={entry.modelId} taskId={taskId}>
          {entry.displayName}
        </ModelLink>
      ),
      id: "model",
      label: "Model",
      sortKey: "modelName",
    },
    {
      cell: (entry) => entry.averageScore?.toFixed(2) ?? "Not scored",
      cellClassName: (entry) =>
        entry.averageScore === null ? "text-muted-foreground" : "font-semibold",
      id: "score",
      isNumber: true,
      label: "Score / 10",
      sortKey: "averageScore",
    },
    {
      cell: (entry) => <CasesScored entry={entry} totalRuns={totalRuns} />,
      id: "casesScored",
      isNumber: true,
      label: "Cases scored",
      title: HISTORICAL_ATTEMPTS_NOTE,
    },
    ...shownWhen(
      entries.some((entry) => entry.accuracy !== null),
      {
        cell: (entry) => (entry.accuracy === null ? "—" : formatPercent(entry.accuracy)),
        id: "accuracy",
        isNumber: true,
        label: "Accuracy",
      },
    ),
    ...shownWhen(
      entries.some((entry) => entry.summary.keyFlaws.recordedOutputs > 0),
      {
        cell: (entry) => (
          <KeyFlawCount model={{ modelId: entry.modelId, taskId }} summary={entry.summary} />
        ),
        id: "keyFlaws",
        label: "Key flaws",
      },
    ),
    {
      cell: (entry) => formatDollars(entry.costPer1000Runs),
      id: "cost",
      isNumber: true,
      label: "Cost / 1k runs",
      sortKey: "costPer1000Runs",
    },
    {
      cell: (entry) => formatSeconds(entry.latencyP50),
      id: "latencyP50",
      isNumber: true,
      label: "Latency p50",
      sortKey: "latencyP50",
    },
    ...shownWhen(
      entries.some((entry) => entry.meetsLatencyBudget !== null),
      {
        cell: (entry) => formatLatencyVerdict(entry.meetsLatencyBudget),
        cellClassName: (entry) =>
          entry.meetsLatencyBudget === false ? "text-warning-text" : undefined,
        id: "latencyBudget",
        label: "Latency budget",
      },
    ),
  ];
}

function getMoreColumns(entries: LeaderboardEntry[], taskId: string): Column[] {
  const categories = entries.find((entry) => entry.categoryScores.length > 0)?.categoryScores ?? [];

  const caseCount = (kind: "attempted" | "generated" | "scored", label: string): Column => ({
    cell: (entry) => (
      <CaseCount
        caseIds={entry.summary.caseIds[kind]}
        count={entry.summary[kind]}
        model={{ modelId: entry.modelId, taskId }}
      />
    ),
    id: kind,
    isNumber: true,
    label,
  });

  return [
    {
      cell: (entry) => formatSeconds(entry.latencyP95),
      id: "latencyP95",
      isNumber: true,
      label: "p95",
      sortKey: "latencyP95",
    },
    { cell: (entry) => entry.provider, id: "provider", label: "Provider", sortKey: "provider" },
    { cell: (entry) => entry.reasoning, id: "reasoning", label: "Reasoning", sortKey: "reasoning" },
    ...categories.map((category): Column => ({
      cell: (entry) =>
        entry.categoryScores
          .find((score) => score.categoryId === category.categoryId)
          ?.score.toFixed(2) ?? "—",
      id: `category-${category.categoryId}`,
      isNumber: true,
      label: category.label,
    })),
    ...REQUIRED_LANGUAGES.map((language): Column => ({
      cell: (entry) =>
        formatLanguageResults(entry.languages).find((result) => result.language === language)?.text,
      id: `language-${language}`,
      isNumber: true,
      label: language.toUpperCase(),
    })),
    { ...caseCount("attempted", "Attempted"), title: HISTORICAL_ATTEMPTS_NOTE },
    caseCount("generated", "Generated"),
    caseCount("scored", "Scored"),
    {
      cell: (entry) => (
        <FailureCounts model={{ modelId: entry.modelId, taskId }} summary={entry.summary} />
      ),
      id: "failedRuns",
      label: "Failed runs",
    },
    ...shownWhen(
      entries.some((entry) => entry.judgeCost > 0),
      {
        cell: (entry) => formatDollars(entry.judgeCost),
        id: "judgeCost",
        isNumber: true,
        label: "Judge cost",
      },
    ),
  ];
}

export function Leaderboard({
  taskId,
  entries,
  totalRuns,
}: {
  taskId: string;
  entries: LeaderboardEntry[];
  totalRuns: number;
}) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <LeaderboardTable
      columns={getColumns({ entries, taskId, totalRuns })}
      description="Each output is scored on its own, against its test case."
      entries={entries}
      moreColumns={getMoreColumns(entries, taskId)}
      renderActions={(sortedEntries) => (
        <LeaderboardExport entries={sortedEntries} taskId={taskId} />
      )}
    />
  );
}
