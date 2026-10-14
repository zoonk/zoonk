import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { StatsPage } from "../_components/stats-page";
import { StatsOverview, StatsOverviewSkeleton } from "./stats-overview";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Your belt, Energy, study days, right answers and when you do best."),
    title: t("Statistics"),
  };
}

/**
 * The statistics section's overview: every stat with its number, each one tap from its page. It
 * opens from the account menu and the level beside the avatar.
 */
export default async function StatisticsPage() {
  const t = await getExtracted();

  return (
    <StatsPage eyebrow={t("All goals")} title={t("Statistics")}>
      <Suspense fallback={<StatsOverviewSkeleton />}>
        <StatsOverview />
      </Suspense>
    </StatsPage>
  );
}
