import { getSingleSearchParamValue, resolveAiTaskDateRange } from "@/data/stats/ai/ai-task-stats";
import { type Metadata } from "next";
import { Suspense } from "react";
import { StatsPageLayout } from "../_components/stats-page-layout";
import { AiFallbackTaskList, AiFallbackTaskListSkeleton } from "./ai-fallback-task-list";
import { AiTaskDirectory } from "./ai-task-directory";
import { AiTaskDirectoryControls } from "./ai-task-directory-controls";
import { AiTaskList, AiTaskListSkeleton } from "./ai-task-list";

export const metadata: Metadata = {
  title: "AI Tasks",
};

/**
 * The AI stats index keeps its default render lightweight, then streams only the
 * specific on-demand report the admin asked for while keeping the task directory
 * visible underneath.
 */
export default async function AiTasksPage({ searchParams }: PageProps<"/stats/ai">) {
  const resolvedSearchParams = await searchParams;
  const range = resolveAiTaskDateRange({
    from: getSingleSearchParamValue(resolvedSearchParams.from),
    to: getSingleSearchParamValue(resolvedSearchParams.to),
  });
  const activeView = resolveAiTaskPageView(getSingleSearchParamValue(resolvedSearchParams.view));

  return (
    <StatsPageLayout showPeriodTabs={false} title="AI Tasks">
      <div className="flex flex-col gap-10">
        <AiTaskDirectoryControls
          activeView={activeView}
          endDate={range.endInput}
          startDate={range.startInput}
        />

        {activeView === "summary" ? (
          <Suspense fallback={<AiTaskListSkeleton />}>
            <AiTaskList endDate={range.endInput} startDate={range.startInput} />
          </Suspense>
        ) : null}

        {activeView === "fallbacks" ? (
          <Suspense fallback={<AiFallbackTaskListSkeleton />}>
            <AiFallbackTaskList endDate={range.endInput} startDate={range.startInput} />
          </Suspense>
        ) : null}

        <AiTaskDirectory endDate={range.endInput} startDate={range.startInput} />
      </div>
    </StatsPageLayout>
  );
}

/**
 * The index exposes a small set of on-demand report views. Narrowing the raw
 * query string to those known values keeps the page logic explicit and ignores
 * any unsupported value without throwing.
 */
function resolveAiTaskPageView(value?: string) {
  if (value === "summary" || value === "fallbacks") {
    return value;
  }
}
