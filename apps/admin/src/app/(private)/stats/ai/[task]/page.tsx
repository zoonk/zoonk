import { formatAiTaskLabel, isAiTaskName } from "@/data/stats/ai/ai-task-stats";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StatsPageLayout } from "../../_components/stats-page-layout";
import { AiTaskReport, AiTaskReportSkeleton } from "./ai-task-report";

/**
 * Dynamic metadata keeps the browser title aligned with the task the admin is
 * inspecting instead of showing a generic route label for every detail page.
 */
export async function generateMetadata({
  params,
}: PageProps<"/stats/ai/[task]">): Promise<Metadata> {
  const { task } = await params;

  if (!isAiTaskName(task)) {
    return { title: "AI Task" };
  }

  return {
    title: formatAiTaskLabel(task),
  };
}

/**
 * Each task gets its own detail page so the model table and cost estimate can
 * be linked directly from the task index without adding client-side routing
 * logic inside the stats views.
 */
export default async function AiTaskPage({ params, searchParams }: PageProps<"/stats/ai/[task]">) {
  const { task } = await params;

  if (!isAiTaskName(task)) {
    notFound();
  }

  const taskLabel = formatAiTaskLabel(task);

  return (
    <StatsPageLayout
      breadcrumbItems={[{ href: "/stats/ai", label: "AI Tasks" }, { label: taskLabel }]}
      showPeriodTabs={false}
      title={taskLabel}
    >
      <Suspense fallback={<AiTaskReportSkeleton />}>
        <AiTaskReport searchParams={searchParams} taskName={task} />
      </Suspense>
    </StatsPageLayout>
  );
}
