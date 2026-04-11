import { type Metadata } from "next";
import { Suspense } from "react";
import { StatsPageLayout } from "../_components/stats-page-layout";
import { AiTaskList, AiTaskListSkeleton } from "./ai-task-list";

export const metadata: Metadata = {
  title: "AI Tasks",
};

/**
 * The AI stats index is its own stats subsection, so it reuses the shared stats
 * shell and streams the task table once the gateway report has loaded.
 */
export default function AiTasksPage() {
  return (
    <StatsPageLayout showPeriodTabs={false} title="AI Tasks">
      <Suspense fallback={<AiTaskListSkeleton />}>
        <AiTaskList />
      </Suspense>
    </StatsPageLayout>
  );
}
