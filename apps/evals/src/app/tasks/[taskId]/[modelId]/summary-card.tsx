import { CaseCount, FailureCounts, KeyFlawCount } from "@/components/eval-counts";
import { type EvalSummary, HISTORICAL_ATTEMPTS_NOTE } from "@/lib/eval-summary";
import { formatDollars, formatPercent, formatSeconds } from "@/lib/format";
import { type TaskStats } from "@/lib/stats";
import { ChevronRightIcon } from "lucide-react";
import { type ReactNode } from "react";

function Headline({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm tabular-nums">{value}</dd>
    </div>
  );
}

export function SummaryCard({
  summary,
  stats,
  totalRuns,
}: {
  summary: EvalSummary;
  stats: TaskStats;
  totalRuns: number;
}) {
  return (
    <section className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        <Headline label="Score" value={summary.averageScore?.toFixed(2) ?? "Not scored"} />

        {stats.classification && (
          <Headline label="Accuracy" value={formatPercent(stats.classification.accuracy)} />
        )}

        {summary.keyFlaws.recordedOutputs > 0 && (
          <Headline
            label="Key flaws"
            value={
              <div className="text-sm font-normal">
                <KeyFlawCount summary={summary} />
              </div>
            }
          />
        )}

        <Headline label="Cost per 1,000 runs" value={formatDollars(stats.costPer1000Runs)} />
        <Headline label="Latency p50" value={formatSeconds(stats.latencyP50)} />
        <Headline label="Cases scored" value={`${summary.scored}/${totalRuns}`} />
      </dl>

      <details className="group">
        <summary className="text-muted-foreground flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 transition-transform group-open:rotate-90"
          />
          Details
        </summary>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 pt-2 md:grid-cols-4">
          <Detail label="Latency p95" value={formatSeconds(stats.latencyP95)} />
          <Detail label="Average input tokens" value={Math.round(stats.averageInputTokens)} />
          <Detail label="Average output tokens" value={Math.round(stats.averageOutputTokens)} />
          <Detail label="Spent on this run" value={formatDollars(stats.runCost)} />

          {stats.judgeCost > 0 && (
            <Detail label="Spent on the judge" value={formatDollars(stats.judgeCost)} />
          )}

          {stats.extraCost > 0 && (
            <Detail label="Spent on other calls" value={formatDollars(stats.extraCost)} />
          )}

          <Detail
            label="Attempted"
            value={<CaseCount caseIds={summary.caseIds.attempted} count={summary.attempted} />}
          />
          <Detail
            label="Generated"
            value={<CaseCount caseIds={summary.caseIds.generated} count={summary.generated} />}
          />
          <Detail
            label="Scored"
            value={<CaseCount caseIds={summary.caseIds.scored} count={summary.scored} />}
          />
          <Detail label="Failed runs" value={<FailureCounts summary={summary} />} />
        </dl>

        <p className="text-muted-foreground pt-4 text-xs">{HISTORICAL_ATTEMPTS_NOTE}</p>
      </details>
    </section>
  );
}
