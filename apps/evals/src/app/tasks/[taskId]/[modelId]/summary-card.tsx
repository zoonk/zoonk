import { formatDollars, formatPercent, formatSeconds } from "@/lib/format";
import { type TaskStats } from "@/lib/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@zoonk/ui/components/card";

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export function SummaryCard({ averageScore, stats }: { averageScore: number; stats: TaskStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
      </CardHeader>

      <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatItem label="Average Score" value={averageScore.toFixed(2)} />

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
      </CardContent>
    </Card>
  );
}
