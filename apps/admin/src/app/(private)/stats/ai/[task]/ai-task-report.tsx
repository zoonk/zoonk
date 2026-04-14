import { buildAiTaskReportHref } from "@/data/stats/ai/ai-task-hrefs";
import {
  getAiTaskHref,
  getSingleSearchParamValue,
  isAiTaskName,
  resolveAiTaskDateRange,
  resolveEstimateRunCount,
} from "@/data/stats/ai/ai-task-stats";
import { type AiTaskOverview, getAiTaskOverview } from "@/data/stats/ai/get-ai-task-overview";
import { getAiTaskReport } from "@/data/stats/ai/get-ai-task-report";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { notFound } from "next/navigation";
import { AiStatsFilters } from "../ai-stats-filters";
import { AiTaskBreakdownSection, AiTaskSummarySection } from "./ai-task-report-sections";

type AiTaskDetailSearchParams = Promise<{
  from?: string | string[];
  runs?: string | string[];
  to?: string | string[];
  view?: string | string[];
}>;

type AiTaskDetailReport = Awaited<ReturnType<typeof getAiTaskReport>>;

type AiTaskReportState = {
  breakdownHref: string;
  overviewHref: string;
  range: {
    endInput: string;
    startInput: string;
  };
  report: AiTaskDetailReport | null;
  runCount: number;
  showBreakdown: boolean;
  summary: AiTaskOverview;
};

/**
 * The task detail view resolves the URL filters, loads the grouped gateway
 * report, and renders the two outputs the user cares about: model breakdowns
 * and a cost estimate based on the selected range.
 */
export async function AiTaskReport({
  searchParams,
  taskName,
}: {
  searchParams: AiTaskDetailSearchParams;
  taskName: string;
}) {
  if (!isAiTaskName(taskName)) {
    notFound();
  }

  const { breakdownHref, overviewHref, range, report, runCount, showBreakdown, summary } =
    await getAiTaskReportState({ searchParams, taskName });

  return (
    <div className="flex flex-col gap-8">
      <AiStatsFilters
        actionHref={getAiTaskHref(taskName)}
        endDate={range.endInput}
        runCount={runCount}
        startDate={range.startInput}
      />

      <AiTaskSummarySection
        breakdownHref={breakdownHref}
        range={range}
        report={report}
        runCount={runCount}
        showBreakdown={showBreakdown}
        summary={summary}
      />

      <AiTaskBreakdownSection
        overviewHref={overviewHref}
        report={report}
        showBreakdown={showBreakdown}
      />
    </div>
  );
}

/**
 * The detail page has a few moving parts in the query string. Resolving them in
 * one place keeps the main component short and makes the on-demand breakdown
 * flow explicit.
 */
async function getAiTaskReportState({
  searchParams,
  taskName,
}: {
  searchParams: AiTaskDetailSearchParams;
  taskName: string;
}): Promise<AiTaskReportState> {
  const resolvedSearchParams = await searchParams;
  const range = resolveAiTaskDateRange({
    from: getSingleSearchParamValue(resolvedSearchParams.from),
    to: getSingleSearchParamValue(resolvedSearchParams.to),
  });
  const runCount = resolveEstimateRunCount(getSingleSearchParamValue(resolvedSearchParams.runs));
  const showBreakdown = shouldShowAiTaskBreakdown(
    getSingleSearchParamValue(resolvedSearchParams.view),
  );
  const overviewHref = buildAiTaskReportHref({
    endDate: range.endInput,
    runCount,
    startDate: range.startInput,
    taskName,
  });
  const breakdownHref = buildAiTaskReportHref({
    endDate: range.endInput,
    runCount,
    startDate: range.startInput,
    taskName,
    view: "breakdown",
  });
  const report = showBreakdown
    ? await getAiTaskReport({
        endDate: range.endInput,
        runCount,
        startDate: range.startInput,
        taskName,
      })
    : null;

  return {
    breakdownHref,
    overviewHref,
    range,
    report,
    runCount,
    showBreakdown,
    summary:
      report ??
      (await getAiTaskOverview({
        endDate: range.endInput,
        runCount,
        startDate: range.startInput,
        taskName,
      })),
  };
}

/**
 * The task detail page now distinguishes the cheap overview from the more
 * expensive model drill-down with an explicit `view` flag in the URL.
 */
function shouldShowAiTaskBreakdown(view?: string) {
  return view === "breakdown";
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
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}
