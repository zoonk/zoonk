"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  getDefaultSortDirection,
  getLeaderboardEntries,
  type LeaderboardEntry,
  type SortDirection,
  type SortKey,
  sortLeaderboardEntries,
} from "@/lib/leaderboard";
import type { TaskEvalResults } from "@/lib/types";
import { LeaderboardExport } from "./leaderboard-export";

interface LeaderboardProps {
  taskId: string;
  results: TaskEvalResults[];
}

export function Leaderboard({ taskId, results }: LeaderboardProps) {
  const entries: LeaderboardEntry[] = useMemo(
    () => getLeaderboardEntries(results),
    [results],
  );

  const [sortKey, setSortKey] = useState<SortKey>("averageScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedEntries = useMemo(
    () => sortLeaderboardEntries(entries, sortKey, sortDirection),
    [entries, sortKey, sortDirection],
  );

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
        <h2 className="font-semibold text-lg">Leaderboard</h2>
        <LeaderboardExport taskId={taskId} entries={sortedEntries} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("modelName")}
            >
              Model{" "}
              {sortKey === "modelName" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>

            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("provider")}
            >
              Provider{" "}
              {sortKey === "provider" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>

            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("averageScore")}
            >
              Avg Score{" "}
              {sortKey === "averageScore" &&
                (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>

            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("totalCost")}
            >
              Cost{" "}
              {sortKey === "totalCost" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {sortedEntries.map((entry) => (
            <TableRow key={entry.modelId}>
              <TableCell>
                <Link
                  href={`/tasks/${taskId}/${encodeURIComponent(entry.modelId)}`}
                >
                  {entry.modelName}
                </Link>
              </TableCell>
              <TableCell>{entry.provider}</TableCell>
              <TableCell>{entry.averageScore.toFixed(2)}</TableCell>
              <TableCell>${entry.totalCost.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
