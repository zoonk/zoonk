import { CaseCount, FailureCounts, KeyFlawCount } from "@/components/eval-counts";
import { type EvalSummary, HISTORICAL_ATTEMPTS_NOTE } from "@/lib/eval-summary";
import { formatDollars, formatPercent, formatSeconds } from "@/lib/format";
import { type TaskStats } from "@/lib/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@zoonk/ui/components/card";
import { type ReactNode } from "react";

function StatItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

export function SummaryCard({ summary, stats }: { summary: EvalSummary; stats: TaskStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
        <p className="text-muted-foreground text-sm">{HISTORICAL_ATTEMPTS_NOTE}</p>
      </CardHeader>

      <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatItem
          label="Average score (scored outputs)"
          value={summary.averageScore?.toFixed(2) ?? "Unscored"}
        />
        <StatItem
          label="Attempted (recorded)"
          value={<CaseCount caseIds={summary.caseIds.attempted} count={summary.attempted} />}
        />
        <StatItem
          label="Generated"
          value={<CaseCount caseIds={summary.caseIds.generated} count={summary.generated} />}
        />
        <StatItem
          label="Scored outputs"
          value={<CaseCount caseIds={summary.caseIds.scored} count={summary.scored} />}
        />
        <StatItem label="Generation failures" value={<FailureCounts summary={summary} />} />
        <StatItem
          label="Judge-flagged key flaws"
          value={
            <div className="text-sm">
              <KeyFlawCount summary={summary} />
            </div>
          }
        />

        {stats.classification && (
          <StatItem label="Accuracy" value={formatPercent(stats.classification.accuracy)} />
        )}

        <StatItem label="Latency p50" value={formatSeconds(stats.latencyP50)} />

        <StatItem label="Latency p95" value={formatSeconds(stats.latencyP95)} />

        <StatItem label="Avg Input Tokens" value={Math.round(stats.averageInputTokens)} />

        <StatItem label="Avg Output Tokens" value={Math.round(stats.averageOutputTokens)} />

        <StatItem label="Cost (1000 runs)" value={formatDollars(stats.costPer1000Runs)} />

        <StatItem label="Spent on this run" value={formatDollars(stats.runCost)} />

        {stats.judgeCost > 0 && (
          <StatItem label="Spent on the judge" value={formatDollars(stats.judgeCost)} />
        )}

        {stats.extraCost > 0 && (
          <StatItem label="Spent on other calls" value={formatDollars(stats.extraCost)} />
        )}
      </CardContent>
    </Card>
  );
}
