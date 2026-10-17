import { type Metadata } from "next";
import { Suspense } from "react";
import {
  StatsExplorerPageSkeleton,
  StatsExplorerSkeleton,
} from "../_components/stats-explorer-layout";
import { StatsExplorerRoute } from "../_components/stats-explorer-route";
import { EngagementMetrics } from "./engagement-metrics";
import { LearnerMilestones, LearnerMilestonesSkeleton } from "./learner-milestones";

export const metadata: Metadata = { title: "Engagement Stats" };

/**
 * Engagement renders either one period analysis or the all-time milestone
 * tool instead of showing both simultaneously.
 */
export default function EngagementPage({ searchParams }: PageProps<"/stats/engagement">) {
  return (
    <Suspense fallback={<StatsExplorerPageSkeleton />}>
      <StatsExplorerRoute path="/stats/engagement" searchParams={searchParams}>
        {({ params, periodQuery, selectedView, statsPeriod }) =>
          selectedView.id === "learner-milestones" ? (
            <Suspense fallback={<LearnerMilestonesSkeleton />}>
              <LearnerMilestones searchParams={params} />
            </Suspense>
          ) : (
            <Suspense
              fallback={<StatsExplorerSkeleton />}
              key={`${selectedView.id}-${periodQuery}`}
            >
              <EngagementMetrics statsPeriod={statsPeriod} view={selectedView} />
            </Suspense>
          )
        }
      </StatsExplorerRoute>
    </Suspense>
  );
}
