"use client";

import { CaseCount, FailureCounts, KeyFlawCount } from "@/components/eval-counts";
import { REQUIRED_LANGUAGES, formatLanguageResults } from "@/lib/case-languages";
import { FAILURE_REASONS, HISTORICAL_ATTEMPTS_NOTE } from "@/lib/eval-summary";
import { formatDollars, formatLatencyVerdict, formatPercent, formatSeconds } from "@/lib/format";
import { type LeaderboardEntry } from "@/lib/leaderboard";
import {
  type SortDirection,
  type SortKey,
  getDefaultSortDirection,
  sortLeaderboardEntries,
} from "@/lib/leaderboard-sort";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import Link from "next/link";
import { useState } from "react";
import { LeaderboardExport } from "./leaderboard-export";
import { MoreColumnsButton, SortHead } from "./leaderboard-parts";

/** How much of the task a model's score rests on, with failed runs called out. */
function CasesScored({ entry, totalRuns }: { entry: LeaderboardEntry; totalRuns: number }) {
  const failed = FAILURE_REASONS.reduce(
    (total, reason) => total + entry.summary.failures[reason].count,
    0,
  );

  return (
    <>
      {entry.summary.scored}/{totalRuns}
      {failed > 0 && (
        <span className="text-destructive-text">
          {" "}
          · {failed} {failed === 1 ? "run" : "runs"} failed
        </span>
      )}
    </>
  );
}

/** A column shows only when some model has a value for it. */
function getColumns(entries: LeaderboardEntry[]) {
  return {
    categories: entries.find((entry) => entry.categoryScores.length > 0)?.categoryScores ?? [],
    showAccuracy: entries.some((entry) => entry.accuracy !== null),
    showBudget: entries.some((entry) => entry.meetsLatencyBudget !== null),
    showJudgeCost: entries.some((entry) => entry.judgeCost > 0),
    showKeyFlaws: entries.some((entry) => entry.summary.keyFlaws.recordedOutputs > 0),
  };
}

type Columns = ReturnType<typeof getColumns>;

function MainCells({
  columns,
  entry,
  taskId,
  totalRuns,
}: {
  columns: Columns;
  entry: LeaderboardEntry;
  taskId: string;
  totalRuns: number;
}) {
  return (
    <>
      <TableCell>
        <Link
          className="-my-2 inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline"
          href={`/tasks/${taskId}/${encodeURIComponent(entry.modelId)}`}
        >
          {entry.displayName}
        </Link>
      </TableCell>
      <TableCell
        className={entry.averageScore === null ? "text-muted-foreground" : "font-semibold"}
      >
        {entry.averageScore?.toFixed(2) ?? "Not scored"}
      </TableCell>
      <TableCell>
        <CasesScored entry={entry} totalRuns={totalRuns} />
      </TableCell>
      {columns.showAccuracy && (
        <TableCell>{entry.accuracy === null ? "—" : formatPercent(entry.accuracy)}</TableCell>
      )}
      {columns.showKeyFlaws && (
        <TableCell>
          <KeyFlawCount model={{ modelId: entry.modelId, taskId }} summary={entry.summary} />
        </TableCell>
      )}
      <TableCell>{formatDollars(entry.costPer1000Runs)}</TableCell>
      <TableCell>{formatSeconds(entry.latencyP50)}</TableCell>
      {columns.showBudget && (
        <TableCell className={entry.meetsLatencyBudget === false ? "text-warning-text" : undefined}>
          {formatLatencyVerdict(entry.meetsLatencyBudget)}
        </TableCell>
      )}
    </>
  );
}

function MoreCells({
  columns,
  entry,
  taskId,
}: {
  columns: Columns;
  entry: LeaderboardEntry;
  taskId: string;
}) {
  const model = { modelId: entry.modelId, taskId };

  return (
    <>
      <TableCell>{formatSeconds(entry.latencyP95)}</TableCell>
      <TableCell>{entry.provider}</TableCell>
      <TableCell>{entry.reasoning}</TableCell>
      {columns.categories.map((category) => (
        <TableCell key={category.categoryId}>
          {entry.categoryScores
            .find((score) => score.categoryId === category.categoryId)
            ?.score.toFixed(2) ?? "—"}
        </TableCell>
      ))}
      {formatLanguageResults(entry.languages).map((result) => (
        <TableCell key={result.language}>{result.text}</TableCell>
      ))}
      <TableCell>
        <CaseCount
          caseIds={entry.summary.caseIds.attempted}
          count={entry.summary.attempted}
          model={model}
        />
      </TableCell>
      <TableCell>
        <CaseCount
          caseIds={entry.summary.caseIds.generated}
          count={entry.summary.generated}
          model={model}
        />
      </TableCell>
      <TableCell>
        <CaseCount
          caseIds={entry.summary.caseIds.scored}
          count={entry.summary.scored}
          model={model}
        />
      </TableCell>
      <TableCell>
        <FailureCounts model={model} summary={entry.summary} />
      </TableCell>
      {columns.showJudgeCost && <TableCell>{formatDollars(entry.judgeCost)}</TableCell>}
    </>
  );
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
  const [sortKey, setSortKey] = useState<SortKey>("averageScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showsMore, setShowsMore] = useState(false);

  const sortedEntries = sortLeaderboardEntries(entries, sortKey, sortDirection);
  const columns = getColumns(entries);
  const { categories, showAccuracy, showBudget, showJudgeCost, showKeyFlaws } = columns;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(getDefaultSortDirection(key));
  }

  function sortProps(key: SortKey) {
    return { direction: sortDirection, isActive: sortKey === key, onSort: () => handleSort(key) };
  }

  if (sortedEntries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Each output is scored on its own, against its test case.
        </p>

        <div className="flex items-center gap-2">
          <MoreColumnsButton isOpen={showsMore} onToggle={() => setShowsMore((shown) => !shown)} />
          <LeaderboardExport entries={sortedEntries} taskId={taskId} />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <SortHead {...sortProps("modelName")}>Model</SortHead>
            <SortHead {...sortProps("averageScore")}>Score / 10</SortHead>
            <TableHead title={HISTORICAL_ATTEMPTS_NOTE}>Cases scored</TableHead>
            {showAccuracy && <TableHead>Accuracy</TableHead>}
            {showKeyFlaws && <TableHead>Key flaws</TableHead>}
            <SortHead {...sortProps("costPer1000Runs")}>Cost / 1k runs</SortHead>
            <SortHead {...sortProps("latencyP50")}>Latency p50</SortHead>
            {showBudget && <TableHead>Latency budget</TableHead>}

            {showsMore && (
              <>
                <SortHead {...sortProps("latencyP95")}>p95</SortHead>
                <SortHead {...sortProps("provider")}>Provider</SortHead>
                <SortHead {...sortProps("reasoning")}>Reasoning</SortHead>
                {categories.map((category) => (
                  <TableHead key={category.categoryId}>{category.label}</TableHead>
                ))}
                {REQUIRED_LANGUAGES.map((language) => (
                  <TableHead key={language}>{language.toUpperCase()}</TableHead>
                ))}
                <TableHead title={HISTORICAL_ATTEMPTS_NOTE}>Attempted</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead>Scored</TableHead>
                <TableHead>Failed runs</TableHead>
                {showJudgeCost && <TableHead>Judge cost</TableHead>}
              </>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {sortedEntries.map((entry) => (
            <TableRow key={entry.modelId}>
              <MainCells columns={columns} entry={entry} taskId={taskId} totalRuns={totalRuns} />
              {showsMore && <MoreCells columns={columns} entry={entry} taskId={taskId} />}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
