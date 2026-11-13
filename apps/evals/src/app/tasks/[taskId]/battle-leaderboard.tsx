"use client";

import { ColumnDollars } from "@/components/column-dollars";
import { formatDollars, formatSeconds } from "@/lib/format";
import { type BattleLeaderboardEntry } from "@/lib/types";
import { type LeaderboardColumn, LeaderboardTable, ModelLink } from "./leaderboard-table";

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
    {
      cell: (entry) => <ColumnDollars value={entry.costPer1000Runs} />,
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
  ];

  const moreColumns: Column[] = [
    {
      cell: (entry) => formatSeconds(entry.latencyP95),
      id: "latencyP95",
      isNumber: true,
      label: "p95",
      sortKey: "latencyP95",
    },
    { cell: (entry) => entry.provider, id: "provider", label: "Provider", sortKey: "provider" },
    ...(entries[0]?.categoryScores ?? []).map((category): Column => ({
      cell: (entry) =>
        entry.categoryScores
          .find((score) => score.categoryId === category.categoryId)
          ?.score.toFixed(2) ?? "—",
      id: `category-${category.categoryId}`,
      isNumber: true,
      label: category.label,
    })),
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
