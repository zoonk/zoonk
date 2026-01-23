"use client";

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

type SortKey =
  | "modelName"
  | "provider"
  | "totalScore"
  | "averageScore"
  | "averageDuration"
  | "averageCost";

type SortDirection = "asc" | "desc";

type BattleLeaderboardProps = {
  taskId: string;
  entries: BattleLeaderboardEntry[];
};

const DEFAULT_SORT_DIRECTIONS: Record<SortKey, SortDirection> = {
  averageCost: "desc",
  averageDuration: "desc",
  averageScore: "desc",
  modelName: "asc",
  provider: "asc",
  totalScore: "desc",
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

export function BattleLeaderboard({ taskId, entries }: BattleLeaderboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>("totalScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedEntries = sortEntries(entries, sortKey, sortDirection);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(getDefaultSortDirection(key));
  }

  if (sortedEntries.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        No battle results yet. Run Battle Mode to compare models.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>

          <TableHead className="cursor-pointer" onClick={() => handleSort("modelName")}>
            Model {sortKey === "modelName" && (sortDirection === "asc" ? "↑" : "↓")}
          </TableHead>

          <TableHead className="cursor-pointer" onClick={() => handleSort("provider")}>
            Provider {sortKey === "provider" && (sortDirection === "asc" ? "↑" : "↓")}
          </TableHead>

          <TableHead className="cursor-pointer" onClick={() => handleSort("totalScore")}>
            Total Points {sortKey === "totalScore" && (sortDirection === "asc" ? "↑" : "↓")}
          </TableHead>

          <TableHead className="cursor-pointer" onClick={() => handleSort("averageScore")}>
            Avg Score {sortKey === "averageScore" && (sortDirection === "asc" ? "↑" : "↓")}
          </TableHead>

          <TableHead className="cursor-pointer" onClick={() => handleSort("averageDuration")}>
            Avg Duration {sortKey === "averageDuration" && (sortDirection === "asc" ? "↑" : "↓")}
          </TableHead>

          <TableHead className="cursor-pointer" onClick={() => handleSort("averageCost")}>
            Avg Cost {sortKey === "averageCost" && (sortDirection === "asc" ? "↑" : "↓")}
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {sortedEntries.map((entry, index) => (
          <TableRow key={entry.modelId}>
            <TableCell className="font-medium">{index + 1}</TableCell>
            <TableCell>
              <Link href={`/tasks/${taskId}/${encodeURIComponent(entry.modelId)}`}>
                {entry.modelName}
              </Link>
            </TableCell>
            <TableCell>{entry.provider}</TableCell>
            <TableCell className="font-semibold">{entry.totalScore.toFixed(1)}</TableCell>
            <TableCell>{entry.averageScore.toFixed(2)}</TableCell>
            <TableCell>{entry.averageDuration.toFixed(2)}s</TableCell>
            <TableCell>${entry.averageCost.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
