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
import {
  MoreColumnsButton,
  NumberCell,
  NumberHead,
  type SortDirection,
  SortHead,
} from "./leaderboard-parts";

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
    <span className={checks.passed < checks.total ? "text-warning-text" : undefined}>
      {checks.passed}/{checks.total}
    </span>
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
      <p className="text-muted-foreground py-8 text-sm">
        No battles yet. Run a battle to have judges compare the models&apos; outputs side by side.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Judges from other model families compare every model&apos;s output on the same test case.
        </p>

        <MoreColumnsButton isOpen={showsMore} onToggle={() => setShowsMore((shown) => !shown)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <SortHead {...sortProps("modelName")}>Model</SortHead>
            <SortHead isNumber {...sortProps("averageScore")}>
              Score / 10
            </SortHead>
            {hasCodeChecks && <TableHead>Parts passing code checks</TableHead>}
            <SortHead isNumber {...sortProps("costPer1000Runs")}>
              Cost / 1k runs
            </SortHead>
            <SortHead isNumber {...sortProps("latencyP50")}>
              Latency p50
            </SortHead>

            {showsMore && (
              <>
                <SortHead isNumber {...sortProps("latencyP95")}>
                  p95
                </SortHead>
                <SortHead {...sortProps("provider")}>Provider</SortHead>
                {categories.map((category) => (
                  <NumberHead key={category.categoryId}>{category.label}</NumberHead>
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
                  className="-my-2 inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline"
                  href={`/tasks/${taskId}/${encodeURIComponent(entry.modelId)}`}
                >
                  {entry.modelName}
                </Link>
              </TableCell>
              <NumberCell className="font-semibold">{entry.averageScore.toFixed(2)}</NumberCell>
              {hasCodeChecks && (
                <TableCell>
                  <CodeChecks checks={entry.codeChecks} />
                </TableCell>
              )}
              <NumberCell>{formatDollars(entry.costPer1000Runs)}</NumberCell>
              <NumberCell>{formatSeconds(entry.latencyP50)}</NumberCell>

              {showsMore && (
                <>
                  <NumberCell>{formatSeconds(entry.latencyP95)}</NumberCell>
                  <TableCell>{entry.provider}</TableCell>
                  {categories.map((category) => {
                    const categoryScore = entry.categoryScores.find(
                      (score) => score.categoryId === category.categoryId,
                    );

                    return (
                      <NumberCell key={category.categoryId}>
                        {categoryScore?.score.toFixed(2) ?? "—"}
                      </NumberCell>
                    );
                  })}
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="text-muted-foreground text-xs">
        Judges have cost {formatDollars(judgeCost)} so far.
      </p>
    </div>
  );
}
