import { getSingleSearchParamValue, resolveAiTaskDateRange } from "@/data/stats/ai/ai-task-stats";
import { type Metadata } from "next";
import { Suspense } from "react";
import { StatsPageLayout } from "../../_components/stats-page-layout";
import { AiEstimateDashboard, AiEstimateDashboardSkeleton } from "../ai-estimate-dashboard";

export const metadata: Metadata = {
  title: "AI Cost Estimates",
};

/**
 * Workflow cost modeling lives on its own page so the task index can stay
 * focused on raw Gateway activity while this route concentrates on lesson and
 * course cost estimation.
 */
export default async function AiEstimatesPage({ searchParams }: PageProps<"/stats/ai/estimates">) {
  const resolvedSearchParams = await searchParams;
  const range = resolveAiTaskDateRange({
    from: getSingleSearchParamValue(resolvedSearchParams.from),
    to: getSingleSearchParamValue(resolvedSearchParams.to),
  });
  const courseInputOverrides = {
    languageChapterCount: getSingleSearchParamValue(resolvedSearchParams.languageChapterCount),
    languageLessonsPerChapter: getSingleSearchParamValue(
      resolvedSearchParams.languageLessonsPerChapter,
    ),
    regularChapterCount: getSingleSearchParamValue(resolvedSearchParams.regularChapterCount),
    regularCoreLessonsPerChapter: getSingleSearchParamValue(
      resolvedSearchParams.regularCoreLessonsPerChapter,
    ),
    regularCustomLessonsPerChapter: getSingleSearchParamValue(
      resolvedSearchParams.regularCustomLessonsPerChapter,
    ),
  };

  return (
    <StatsPageLayout
      breadcrumbItems={[{ href: "/stats/ai", label: "AI Tasks" }, { label: "Estimates" }]}
      showPeriodTabs={false}
      title="AI Cost Estimates"
    >
      <Suspense fallback={<AiEstimateDashboardSkeleton />}>
        <AiEstimateDashboard
          courseInputOverrides={courseInputOverrides}
          endDate={range.endInput}
          startDate={range.startInput}
        />
      </Suspense>
    </StatsPageLayout>
  );
}
