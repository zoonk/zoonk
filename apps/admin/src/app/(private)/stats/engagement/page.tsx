import { type Metadata } from "next";
import { Suspense } from "react";
import {
  StatsExplorerLayout,
  StatsExplorerPageSkeleton,
  StatsExplorerSkeleton,
} from "../_components/stats-explorer-layout";
import { getStatsAnalysisView } from "../_utils/stats-analysis";
import { buildStatsPeriodQuery, getStatsPeriod } from "../_utils/stats-period";
import { EngagementMetrics } from "./engagement-metrics";
import { LearnerMilestones, LearnerMilestonesSkeleton } from "./learner-milestones";

export const metadata: Metadata = { title: "Engagement Stats" };

/**
 * Engagement keeps an instant route shell while its URL-backed analysis state
 * resolves behind Suspense.
 */
export default function EngagementPage({ searchParams }: PageProps<"/stats/engagement">) {
  return (
    <Suspense fallback={<StatsExplorerPageSkeleton />}>
      <EngagementExplorer searchParams={searchParams} />
    </Suspense>
  );
}

/**
 * Once URL state is available, Engagement renders either one period analysis
 * or the all-time milestone tool instead of showing both simultaneously.
 */
async function EngagementExplorer({
  searchParams,
}: Pick<PageProps<"/stats/engagement">, "searchParams">) {
  const params = await searchParams;
  const statsPeriod = await getStatsPeriod(params);
  const selectedView = getStatsAnalysisView({ path: "/stats/engagement", value: params.view });
  const periodQuery = buildStatsPeriodQuery(statsPeriod);

  return (
    <StatsExplorerLayout
      periodQuery={periodQuery}
      selectedView={selectedView}
      statsPeriod={statsPeriod}
    >
      {selectedView.id === "learner-milestones" ? (
        <Suspense fallback={<LearnerMilestonesSkeleton />}>
          <LearnerMilestones searchParams={params} />
        </Suspense>
      ) : (
        <Suspense fallback={<StatsExplorerSkeleton />} key={`${selectedView.id}-${periodQuery}`}>
          <EngagementMetrics statsPeriod={statsPeriod} view={selectedView} />
        </Suspense>
      )}
    </StatsExplorerLayout>
  );
}
