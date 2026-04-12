import { getSingleSearchParamValue, resolveAiTaskDateRange } from "@/data/stats/ai/ai-task-stats";
import { type Metadata } from "next";
import { Suspense } from "react";
import { StatsPageLayout } from "../_components/stats-page-layout";
import { AiStatsFilters } from "./ai-stats-filters";
import { AiTaskList, AiTaskListSkeleton } from "./ai-task-list";

export const metadata: Metadata = {
  title: "AI Tasks",
};

/**
 * The AI stats index is its own stats subsection, so it reuses the shared stats
 * shell and streams the selected-period task list once the Gateway report has
 * loaded.
 */
export default async function AiTasksPage({ searchParams }: PageProps<"/stats/ai">) {
  const resolvedSearchParams = await searchParams;
  const range = resolveAiTaskDateRange({
    from: getSingleSearchParamValue(resolvedSearchParams.from),
    to: getSingleSearchParamValue(resolvedSearchParams.to),
  });

  return (
    <StatsPageLayout
      navigation={
        <AiStatsFilters
          actionHref="/stats/ai"
          endDate={range.endInput}
          startDate={range.startInput}
        />
      }
      showPeriodTabs={false}
      title="AI Tasks"
    >
      <Suspense fallback={<AiTaskListSkeleton />}>
        <AiTaskList endDate={range.endInput} startDate={range.startInput} />
      </Suspense>
    </StatsPageLayout>
  );
}
