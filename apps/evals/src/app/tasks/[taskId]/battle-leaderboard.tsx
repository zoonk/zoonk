"use client";

import { formatDollars, formatSeconds } from "@/lib/format";
import { type BattleLeaderboardEntry } from "@/lib/types";
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
import { MoreColumnsButton, type SortDirection, SortHead } from "./leaderboard-parts";

type SortKey =
  | "modelName"
  | "provider"
  | "averageScore"
  | "latencyP50"
  | "latencyP95"
  | "costPer1000Runs";

const DEFAULT_SORT_DIRECTIONS: Record<SortKey, SortDirection> = {
  averageScore: "desc",
  costPer1000Runs: "desc",
  latencyP50: "desc",
  latencyP95: "desc",
  modelName: "asc",
  provider: "asc",
};

function getDefaultSortDirection(key: SortKey): SortDirection {
  return DEFAULT_SORT_DIRECTIONS[key];
}

function sortEntries(
  entries: BattleLeaderboardEntry[],
  sortKey: SortKey,
  sortDirection: SortDirection,
): BattleLeaderboardEntry[] {
  return [...entries].toSorted((a, b) => {
    const aValue = a[sortKey];
    const bValue = b[sortKey];

    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }

    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });
}

function CodeChecks({ checks }: { checks: BattleLeaderboardEntry["codeChecks"] }) {
  if (!checks) {
    return "—";
  }

  return (
    <>
      {checks.passed}/{checks.total} parts
      {checks.problems > 0 && (
        <span className="text-warning-text">
          {" "}
          · {checks.problems} {checks.problems === 1 ? "problem" : "problems"}
        </span>
      )}
    </>
  );
}

export function BattleLeaderboard({
  taskId,
  entries,
  judgeCost,
}: {
  taskId: string;
  entries: BattleLeaderboardEntry[];
  judgeCost: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("averageScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showsMore, setShowsMore] = useState(false);

  const sortedEntries = sortEntries(entries, sortKey, sortDirection);
  const categories = entries[0]?.categoryScores ?? [];
  const hasCodeChecks = entries.some((entry) => entry.codeChecks);

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
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No battles yet. Run a battle to have judges compare the models&apos; outputs side by side.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-2">
        <MoreColumnsButton isOpen={showsMore} onToggle={() => setShowsMore((shown) => !shown)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <SortHead {...sortProps("modelName")}>Model</SortHead>
            <SortHead {...sortProps("averageScore")}>Score</SortHead>
            {hasCodeChecks && <TableHead>Code checks</TableHead>}
            <SortHead {...sortProps("costPer1000Runs")}>Cost / 1k runs</SortHead>
            <SortHead {...sortProps("latencyP50")}>p50</SortHead>

            {showsMore && (
              <>
                <SortHead {...sortProps("latencyP95")}>p95</SortHead>
                <SortHead {...sortProps("provider")}>Provider</SortHead>
                {categories.map((category) => (
                  <TableHead key={category.categoryId}>{category.label}</TableHead>
                ))}
              </>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {sortedEntries.map((entry, index) => (
            <TableRow key={entry.modelId}>
              <TableCell className="text-muted-foreground">{index + 1}</TableCell>
              <TableCell>
                <Link
                  className="font-medium underline-offset-4 hover:underline"
                  href={`/tasks/${taskId}/${encodeURIComponent(entry.modelId)}`}
                >
                  {entry.modelName}
                </Link>
              </TableCell>
              <TableCell className="font-semibold">{entry.averageScore.toFixed(2)}</TableCell>
              {hasCodeChecks && (
                <TableCell>
                  <CodeChecks checks={entry.codeChecks} />
                </TableCell>
              )}
              <TableCell>{formatDollars(entry.costPer1000Runs)}</TableCell>
              <TableCell>{formatSeconds(entry.latencyP50)}</TableCell>

              {showsMore && (
                <>
                  <TableCell>{formatSeconds(entry.latencyP95)}</TableCell>
                  <TableCell>{entry.provider}</TableCell>
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
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="text-muted-foreground text-xs">
        A judge never scores its own model family. Judges have cost {formatDollars(judgeCost)} so
        far.
      </p>
    </div>
  );
}
