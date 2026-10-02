import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { StatsPage } from "../_components/stats-page";
import { ActivityContent, ActivityContentSkeleton } from "./activity-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Track your completed lessons, learning days, and learning time."),
    title: t("Activity"),
  };
}

export default async function ActivityPage() {
  const t = await getExtracted();

  return (
    <StatsPage description={t("See your learning activity over time")} title={t("Activity")}>
      <Suspense fallback={<ActivityContentSkeleton />}>
        <ActivityContent />
      </Suspense>
    </StatsPage>
  );
}
