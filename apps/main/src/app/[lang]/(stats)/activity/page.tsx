import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { StatsPage } from "../_components/stats-page";
import { ActivityContent, ActivityContentSkeleton } from "./activity-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Your study days, lessons finished and time spent learning."),
    title: t("Activity"),
  };
}

export default async function ActivityPage() {
  const t = await getExtracted();

  return (
    <StatsPage metric="activity" title={t("Activity")}>
      <Suspense fallback={<ActivityContentSkeleton />}>
        <ActivityContent />
      </Suspense>
    </StatsPage>
  );
}
