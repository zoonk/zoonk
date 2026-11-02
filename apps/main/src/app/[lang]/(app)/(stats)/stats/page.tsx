import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { StatsPage } from "../_components/stats-page";
import { ScoreChartPreload } from "../score/score-chart-preload";
import { OVERVIEW_CHART_MEDIA } from "./overview-chart-media";
import { StatsOverview, StatsOverviewSkeleton } from "./stats-overview";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Your belt, Energy, study days, right answers and when you do best."),
    title: t("Statistics"),
  };
}

export default async function StatisticsPage() {
  const t = await getExtracted();

  return (
    <StatsPage eyebrow={t("All goals")} title={t("Statistics")}>
      <ScoreChartPreload media={OVERVIEW_CHART_MEDIA} />
      <Suspense fallback={<StatsOverviewSkeleton />}>
        <StatsOverview />
      </Suspense>
    </StatsPage>
  );
}
