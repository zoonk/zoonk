"use client";

import { formatDollars } from "@/lib/format";
import { type BattleLeaderboardEntry } from "@/lib/types";
import {
  type LeaderboardColumn,
  LeaderboardTable,
  ModelLink,
  measuredColumns,
} from "./leaderboard-table";

type Column = LeaderboardColumn<BattleLeaderboardEntry>;

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

function getColumns(entries: BattleLeaderboardEntry[], taskId: string) {
  const measured = measuredColumns(entries);

  const codeChecks: Column = {
    cell: (entry) => <CodeChecks checks={entry.codeChecks} />,
    id: "codeChecks",
    isNumber: true,
    label: "Parts passing code checks",
  };

  const columns: Column[] = [
    {
      cell: (_entry, index) => index + 1,
      cellClassName: () => "text-muted-foreground w-10",
      id: "rank",
      label: "#",
    },
    {
      cell: (entry) => (
        <ModelLink modelId={entry.modelId} taskId={taskId}>
          {entry.modelName}
        </ModelLink>
      ),
      id: "model",
      label: "Model",
      sortKey: "modelName",
    },
    {
      cell: (entry) => entry.averageScore.toFixed(2),
      cellClassName: () => "font-semibold",
      id: "score",
      isNumber: true,
      label: "Score / 10",
      sortKey: "averageScore",
    },
    ...(entries.some((entry) => entry.codeChecks) ? [codeChecks] : []),
    measured.cost,
    measured.latencyP50,
  ];

  const moreColumns: Column[] = [
    measured.latencyP95,
    measured.provider,
    ...measured.categoryColumns,
  ];

  return { columns, moreColumns };
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
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-sm">
        No battles yet. Run a battle to have judges compare the models&apos; outputs side by side.
      </p>
    );
  }

  return (
    <LeaderboardTable
      description="Judges from other model families compare every model's output on the same test case."
      entries={entries}
      footer={
        <p className="text-muted-foreground text-xs">
          Judges have cost {formatDollars(judgeCost)} so far.
        </p>
      }
      {...getColumns(entries, taskId)}
    />
  );
}
