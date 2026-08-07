import { type Metadata } from "next";
import { Suspense } from "react";
import {
  StatsExplorerLayout,
  StatsExplorerPageSkeleton,
  StatsExplorerSkeleton,
} from "../_components/stats-explorer-layout";
import { getStatsAnalysisView } from "../_utils/stats-analysis";
import { buildStatsPeriodQuery, getStatsPeriod } from "../_utils/stats-period";
import { ContentMetrics } from "./content-metrics";

export const metadata: Metadata = { title: "Content Stats" };

/**
 * Content keeps an instant route shell while its URL-backed analysis state
 * resolves behind Suspense.
 */
export default function ContentPage({ searchParams }: PageProps<"/stats/content">) {
  return (
    <Suspense fallback={<StatsExplorerPageSkeleton />}>
      <ContentExplorer searchParams={searchParams} />
    </Suspense>
  );
}

/**
 * Once URL state is available, the shared explorer preserves both Content
 * trends and complete operational tables without rendering them together.
 */
async function ContentExplorer({
  searchParams,
}: Pick<PageProps<"/stats/content">, "searchParams">) {
  const params = await searchParams;
  const statsPeriod = await getStatsPeriod(params);
  const selectedView = getStatsAnalysisView({ path: "/stats/content", value: params.view });
  const periodQuery = buildStatsPeriodQuery(statsPeriod);
  const currentSearchParams = new URLSearchParams(periodQuery);
  currentSearchParams.set("view", selectedView.id);

  return (
    <StatsExplorerLayout
      currentQuery={currentSearchParams.toString()}
      path="/stats/content"
      periodQuery={periodQuery}
      selectedView={selectedView}
      statsPeriod={statsPeriod}
    >
      <Suspense fallback={<StatsExplorerSkeleton />} key={`${selectedView.id}-${periodQuery}`}>
        <ContentMetrics statsPeriod={statsPeriod} view={selectedView} />
      </Suspense>
    </StatsExplorerLayout>
  );
}
