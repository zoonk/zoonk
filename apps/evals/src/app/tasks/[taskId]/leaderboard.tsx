"use client";

import { REQUIRED_LANGUAGES, formatLanguageResults } from "@/lib/case-languages";
import { formatDollars, formatLatencyVerdict, formatPercent, formatSeconds } from "@/lib/format";
import {
  type LeaderboardEntry,
  type SortDirection,
  type SortKey,
  getDefaultSortDirection,
  sortLeaderboardEntries,
} from "@/lib/leaderboard";
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

function getSortArrow({
  direction,
  isActive,
}: {
  direction: SortDirection;
  isActive: boolean;
}): string {
  if (!isActive) {
    return "";
  }

  return direction === "asc" ? "↑" : "↓";
}

export function Leaderboard({ taskId, entries }: { taskId: string; entries: LeaderboardEntry[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("averageScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedEntries = sortLeaderboardEntries(entries, sortKey, sortDirection);
  const categories = entries[0]?.categoryScores ?? [];
  const showAccuracy = entries.some((entry) => entry.accuracy !== null);
  const showJudgeCost = entries.some((entry) => entry.judgeCost > 0);
  const showBudget = entries.some((entry) => entry.meetsLatencyBudget !== null);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(getDefaultSortDirection(key));
  }

  if (sortedEntries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Leaderboard</h2>
        <LeaderboardExport entries={sortedEntries} taskId={taskId} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer" onClick={() => handleSort("modelName")}>
              Model {getSortArrow({ direction: sortDirection, isActive: sortKey === "modelName" })}
            </TableHead>

            <TableHead className="cursor-pointer" onClick={() => handleSort("provider")}>
              Provider{" "}
              {getSortArrow({ direction: sortDirection, isActive: sortKey === "provider" })}
            </TableHead>

            <TableHead className="cursor-pointer" onClick={() => handleSort("reasoning")}>
              Reasoning{" "}
              {getSortArrow({ direction: sortDirection, isActive: sortKey === "reasoning" })}
            </TableHead>

            <TableHead className="cursor-pointer" onClick={() => handleSort("averageScore")}>
              Avg Score{" "}
              {getSortArrow({ direction: sortDirection, isActive: sortKey === "averageScore" })}
            </TableHead>

            {categories.map((category) => (
              <TableHead key={category.categoryId}>{category.label}</TableHead>
            ))}

            {showAccuracy && <TableHead>Accuracy</TableHead>}

            {REQUIRED_LANGUAGES.map((language) => (
              <TableHead key={language}>{language.toUpperCase()}</TableHead>
            ))}

            <TableHead className="cursor-pointer" onClick={() => handleSort("latencyP50")}>
              p50 {getSortArrow({ direction: sortDirection, isActive: sortKey === "latencyP50" })}
            </TableHead>

            <TableHead className="cursor-pointer" onClick={() => handleSort("latencyP95")}>
              p95 {getSortArrow({ direction: sortDirection, isActive: sortKey === "latencyP95" })}
            </TableHead>

            <TableHead className="cursor-pointer" onClick={() => handleSort("costPer1000Runs")}>
              Cost / 1k runs{" "}
              {getSortArrow({ direction: sortDirection, isActive: sortKey === "costPer1000Runs" })}
            </TableHead>

            {showBudget && <TableHead>Latency budget</TableHead>}

            {showJudgeCost && <TableHead>Judge cost</TableHead>}
          </TableRow>
        </TableHeader>

        <TableBody>
          {sortedEntries.map((entry) => (
            <TableRow key={entry.modelId}>
              <TableCell>
                <Link href={`/tasks/${taskId}/${encodeURIComponent(entry.modelId)}`}>
                  {entry.modelName}
                </Link>
              </TableCell>
              <TableCell>{entry.provider}</TableCell>
              <TableCell>{entry.reasoning}</TableCell>
              <TableCell>{entry.averageScore.toFixed(2)}</TableCell>
              {categories.map((category) => {
                const categoryScore = entry.categoryScores.find(
                  (score) => score.categoryId === category.categoryId,
                );

                return (
                  <TableCell key={category.categoryId}>
                    {categoryScore?.score.toFixed(2) ?? "—"}
                  </TableCell>
                );
              })}
              {showAccuracy && (
                <TableCell>
                  {entry.accuracy === null ? "—" : formatPercent(entry.accuracy)}
                </TableCell>
              )}
              {formatLanguageResults(entry.languages).map((result) => (
                <TableCell key={result.language}>{result.text}</TableCell>
              ))}
              <TableCell>{formatSeconds(entry.latencyP50)}</TableCell>
              <TableCell>{formatSeconds(entry.latencyP95)}</TableCell>
              <TableCell>{formatDollars(entry.costPer1000Runs)}</TableCell>
              {showBudget && (
                <TableCell>{formatLatencyVerdict(entry.meetsLatencyBudget)}</TableCell>
              )}
              {showJudgeCost && <TableCell>{formatDollars(entry.judgeCost)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
