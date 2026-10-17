import { type Metadata } from "next";
import { Suspense } from "react";
import {
  StatsExplorerPageSkeleton,
  StatsExplorerSkeleton,
} from "../_components/stats-explorer-layout";
import { StatsExplorerRoute } from "../_components/stats-explorer-route";
import { LearningMetrics } from "./learning-metrics";

export const metadata: Metadata = { title: "Learning Stats" };

/**
 * Learning health: how many learners study each day and week, whether they finish sessions and
 * meet their minutes, whether they come back, and how their skills grow.
 */
export default function LearningPage({ searchParams }: PageProps<"/stats/learning">) {
  return (
    <Suspense fallback={<StatsExplorerPageSkeleton />}>
      <StatsExplorerRoute path="/stats/learning" searchParams={searchParams}>
        {({ periodQuery, selectedView, statsPeriod }) => (
          <Suspense fallback={<StatsExplorerSkeleton />} key={`${selectedView.id}-${periodQuery}`}>
            <LearningMetrics statsPeriod={statsPeriod} view={selectedView} />
          </Suspense>
        )}
      </StatsExplorerRoute>
    </Suspense>
  );
}
