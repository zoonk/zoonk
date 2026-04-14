import { type AiTaskOverview } from "@/data/stats/ai/get-ai-task-overview";
import { type getAiTaskReport } from "@/data/stats/ai/get-ai-task-report";
import { buttonVariants } from "@zoonk/ui/components/button";
import Link from "next/link";
import { AdminMetricCard } from "../../_components/admin-metric-card";
import { formatAiCost, formatAiStatsDate } from "../format-ai-cost";
import { AiTaskModelTable } from "./ai-task-model-table";

type AiTaskDetailReport = Awaited<ReturnType<typeof getAiTaskReport>>;

type AiTaskRange = {
  endInput: string;
  startInput: string;
};

/**
 * The overview stays visible whether or not the admin opens the detailed model
 * report, so this section owns the shared summary cards and helper copy.
 */
export function AiTaskSummarySection({
  breakdownHref,
  range,
  report,
  runCount,
  showBreakdown,
  summary,
}: {
  breakdownHref: string;
  range: AiTaskRange;
  report: AiTaskDetailReport | null;
  runCount: number;
  showBreakdown: boolean;
  summary: AiTaskOverview;
}) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm">
        Overview from {formatAiStatsDate(range.startInput)} to {formatAiStatsDate(range.endInput)}.
      </p>

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          description="Gateway-tagged runs for this task in the selected range."
          title="Requests"
          value={summary.totalRequests.toLocaleString()}
        />
        <AdminMetricCard
          description="Historical market spend captured for the task tag."
          title="Total Market Cost"
          value={formatAiCost(summary.totalMarketCost)}
        />
        <AdminMetricCard
          description="The average used for quick planning and comparison."
          title="Avg Market Cost / Request"
          value={formatAiCost(summary.averageMarketCostPerRequest)}
        />
        <AdminMetricCard
          description="Projected from the current average market cost."
          title={`Est. ${runCount.toLocaleString()} Runs`}
          value={formatAiCost(summary.estimatedMarketCost)}
        />
      </div>

      <AiTaskFallbackSummary summary={summary} />
      <AiTaskStatusMessage
        breakdownHref={breakdownHref}
        report={report}
        showBreakdown={showBreakdown}
        totalRequests={summary.totalRequests}
      />
    </div>
  );
}

/**
 * Default-model tags are the only fallback metadata we have on the cheap
 * overview path, so this helper keeps that explanation separate from the cards.
 */
function AiTaskFallbackSummary({ summary }: { summary: AiTaskOverview }) {
  if (!summary.hasFallbackTracking) {
    return (
      <p className="text-muted-foreground text-sm">
        No default-model tags were reported for this time range yet, so fallback requests cannot be
        identified for this period.
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-sm">
      Default model{summary.defaultModels.length === 1 ? "" : "s"}:{" "}
      <span className="text-foreground font-medium">{summary.defaultModels.join(", ")}</span>.
    </p>
  );
}

/**
 * The small paragraph under the cards changes based on whether the task had
 * traffic and whether the admin already opened the model breakdown.
 */
function AiTaskStatusMessage({
  breakdownHref,
  report,
  showBreakdown,
  totalRequests,
}: {
  breakdownHref: string;
  report: AiTaskDetailReport | null;
  showBreakdown: boolean;
  totalRequests: number;
}) {
  if (totalRequests <= 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No gateway requests were reported for this task in the selected range.
      </p>
    );
  }

  if (showBreakdown && report) {
    return (
      <p className="text-muted-foreground text-sm">
        {report.models.length.toLocaleString()} model{report.models.length === 1 ? "" : "s"} in the
        breakdown. Fallback requests in this range:{" "}
        <span className="text-foreground font-medium tabular-nums">
          {report.fallbackRequestCount.toLocaleString()}
        </span>
        .
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-muted-foreground text-sm">
        Load the model breakdown only when you need fallback counts or per-model pricing.
      </p>

      <Link className={buttonVariants({ variant: "outline" })} href={breakdownHref}>
        Load Model Breakdown
      </Link>
    </div>
  );
}

/**
 * The detailed model table is useful, but it should stay visually separate from
 * the cheaper overview so admins can tell when they have opted into the heavier
 * report path.
 */
export function AiTaskBreakdownSection({
  overviewHref,
  report,
  showBreakdown,
}: {
  overviewHref: string;
  report: AiTaskDetailReport | null;
  showBreakdown: boolean;
}) {
  if (!showBreakdown || !report) {
    return (
      <section className="flex flex-col gap-1">
        <h2 className="text-base font-semibold tracking-tight">Model Breakdown</h2>
        <p className="text-muted-foreground text-sm">
          Keep this closed until you need the detailed per-model report. The overview above is the
          cheaper default.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight">Model Breakdown</h2>
          <p className="text-muted-foreground text-sm">
            Per-model request counts and pricing for the selected range.
          </p>
        </div>

        <Link className={buttonVariants({ variant: "ghost" })} href={overviewHref}>
          Hide Breakdown
        </Link>
      </div>

      {report.models.length > 0 ? (
        <div className="rounded-lg border">
          <AiTaskModelTable models={report.models} />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          No gateway requests were reported for this task in the selected range.
        </p>
      )}
    </section>
  );
}
