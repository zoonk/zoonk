import { type Metadata } from "next";
import { Suspense } from "react";
import {
  StatsExplorerLayout,
  StatsExplorerPageSkeleton,
  StatsExplorerSkeleton,
} from "../_components/stats-explorer-layout";
import { getStatsAnalysisView } from "../_utils/stats-analysis";
import { buildStatsPeriodQuery, getStatsPeriod } from "../_utils/stats-period";
import { GrowthMetrics } from "./growth-metrics";

export const metadata: Metadata = { title: "Growth Stats" };

/**
 * Growth keeps an instant route shell while its URL-backed analysis state
 * resolves behind Suspense.
 */
export default function GrowthPage({ searchParams }: PageProps<"/stats/growth">) {
  return (
    <Suspense fallback={<StatsExplorerPageSkeleton />}>
      <GrowthExplorer searchParams={searchParams} />
    </Suspense>
  );
}

/**
 * Once URL state is available, the shared explorer makes this durable route
 * feel continuous with Engagement and Content.
 */
async function GrowthExplorer({ searchParams }: Pick<PageProps<"/stats/growth">, "searchParams">) {
  const params = await searchParams;
  const statsPeriod = await getStatsPeriod(params);
  const selectedView = getStatsAnalysisView({ path: "/stats/growth", value: params.view });
  const periodQuery = buildStatsPeriodQuery(statsPeriod);
  const currentSearchParams = new URLSearchParams(periodQuery);
  currentSearchParams.set("view", selectedView.id);

  return (
    <StatsExplorerLayout
      currentQuery={currentSearchParams.toString()}
      path="/stats/growth"
      periodQuery={periodQuery}
      selectedView={selectedView}
      statsPeriod={statsPeriod}
    >
      <Suspense fallback={<StatsExplorerSkeleton />} key={`${selectedView.id}-${periodQuery}`}>
        <GrowthMetrics statsPeriod={statsPeriod} view={selectedView} />
      </Suspense>
    </StatsExplorerLayout>
  );
}
