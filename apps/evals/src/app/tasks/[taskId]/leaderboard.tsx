"use client";

import { CaseCount, FailureCounts, KeyFlawCount } from "@/components/eval-counts";
import { REQUIRED_LANGUAGES, formatLanguageResults } from "@/lib/case-languages";
import { FAILURE_REASONS, HISTORICAL_ATTEMPTS_NOTE } from "@/lib/eval-summary";
import { formatDollarsColumn, formatLatencyVerdict, formatPercent } from "@/lib/format";
import { type LeaderboardEntry } from "@/lib/leaderboard";
import { FACT_SEPARATOR } from "@zoonk/utils/facts";
import { LeaderboardExport } from "./leaderboard-export";
import {
  type LeaderboardColumn,
  LeaderboardTable,
  ModelLink,
  measuredColumns,
} from "./leaderboard-table";
import { UNSCORED_IMAGES_NOTE } from "./unscored-images";

type Column = LeaderboardColumn<LeaderboardEntry>;

/** How much of the task a model's score rests on; "Failed runs" under "More columns" says why. */
function CasesScored({ entry, totalRuns }: { entry: LeaderboardEntry; totalRuns: number }) {
  const failed = FAILURE_REASONS.reduce(
    (total, reason) => total + entry.summary.failures[reason].count,
    0,
  );

  return (
    <>
      {entry.summary.scored}/{totalRuns}
      {entry.summary.unscoredImages.length > 0 && (
        <span className="text-muted-foreground">
          {FACT_SEPARATOR}
          {entry.summary.unscoredImages.length} images without a score
        </span>
      )}
      {failed > 0 ? (
        <span className="text-destructive-text">
          {FACT_SEPARATOR}
          {failed} failed
        </span>
      ) : null}
    </>
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
  const measured = measuredColumns(entries);

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
    measured.cost,
    measured.latencyP50,
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
  const measured = measuredColumns(entries);

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
    measured.latencyP95,
    measured.provider,
    { cell: (entry) => entry.reasoning, id: "reasoning", label: "Reasoning", sortKey: "reasoning" },
    ...measured.categoryColumns,
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
        cell: formatDollarsColumn(entries, (entry) => entry.judgeCost),
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
      description={
        entries.some((entry) => entry.summary.unscoredImages.length > 0)
          ? `Each output is scored on its own, against its test case. ${UNSCORED_IMAGES_NOTE}`
          : "Each output is scored on its own, against its test case."
      }
      entries={entries}
      moreColumns={getMoreColumns(entries, taskId)}
      renderActions={(sortedEntries) => (
        <LeaderboardExport entries={sortedEntries} taskId={taskId} />
      )}
    />
  );
}
