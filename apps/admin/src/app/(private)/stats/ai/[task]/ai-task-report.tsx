import {
  getAiTaskHref,
  getSingleSearchParamValue,
  isAiTaskName,
  resolveAiTaskDateRange,
  resolveEstimateRunCount,
} from "@/data/stats/ai/ai-task-stats";
import { getAiTaskReport } from "@/data/stats/ai/get-ai-task-report";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { notFound } from "next/navigation";
import { AiStatsFilters } from "../ai-stats-filters";
import { formatAiCost, formatAiStatsDate } from "../format-ai-cost";
import { AiTaskModelTable } from "./ai-task-model-table";

/**
 * The task detail view resolves the URL filters, loads the grouped gateway
 * report, and renders the two outputs the user cares about: model breakdowns
 * and a cost estimate based on the selected range.
 */
export async function AiTaskReport({
  searchParams,
  taskName,
}: {
  searchParams: Promise<{
    from?: string | string[];
    runs?: string | string[];
    to?: string | string[];
  }>;
  taskName: string;
}) {
  if (!isAiTaskName(taskName)) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const range = resolveAiTaskDateRange({
    from: getSingleSearchParamValue(resolvedSearchParams.from),
    to: getSingleSearchParamValue(resolvedSearchParams.to),
  });
  const runCount = resolveEstimateRunCount(getSingleSearchParamValue(resolvedSearchParams.runs));
  const report = await getAiTaskReport({
    endDate: range.endInput,
    runCount,
    startDate: range.startInput,
    taskName,
  });

  return (
    <div className="flex flex-col gap-8">
      <AiStatsFilters
        actionHref={getAiTaskHref(taskName)}
        endDate={range.endInput}
        runCount={runCount}
        startDate={range.startInput}
      />

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          {report.totalRequests.toLocaleString()} requests from{" "}
          {formatAiStatsDate(range.startInput)} to {formatAiStatsDate(range.endInput)} across{" "}
          {report.models.length.toLocaleString()} models.
        </p>

        {report.hasFallbackTracking ? (
          <p className="text-muted-foreground text-sm">
            Default model{report.defaultModels.length === 1 ? "" : "s"}:{" "}
            <span className="text-foreground font-medium">{report.defaultModels.join(", ")}</span>.{" "}
            Fallback requests in this range:{" "}
            <span className="text-foreground font-medium tabular-nums">
              {report.fallbackRequestCount.toLocaleString()}
            </span>
            .
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            No default-model tags were reported for this time range yet, so fallback rows cannot be
            identified here.
          </p>
        )}

        <p className="text-muted-foreground text-sm">
          Based on the current average market cost of{" "}
          <span className="text-foreground font-medium tabular-nums">
            {formatAiCost(report.averageMarketCostPerRequest)}
          </span>{" "}
          per request, {runCount.toLocaleString()} runs would cost about{" "}
          <span className="text-foreground font-medium tabular-nums">
            {formatAiCost(report.estimatedMarketCost)}
          </span>
          .
        </p>
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
    </div>
  );
}

/**
 * The detail page fetches remote analytics, so this placeholder mirrors the
 * filter bar and table footprint while the server report is still loading.
 */
export function AiTaskReportSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-16 w-32 rounded-lg" />
        <Skeleton className="h-16 w-32 rounded-lg" />
        <Skeleton className="h-16 w-32 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-4 w-lg" />
      </div>
      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}
