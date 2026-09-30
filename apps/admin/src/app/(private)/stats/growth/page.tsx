import { type Metadata } from "next";
import { Suspense } from "react";
import {
  StatsExplorerPageSkeleton,
  StatsExplorerSkeleton,
} from "../_components/stats-explorer-layout";
import { StatsExplorerRoute } from "../_components/stats-explorer-route";
import { GrowthMetrics } from "./growth-metrics";

export const metadata: Metadata = { title: "Growth Stats" };

/**
 * Growth keeps an instant route shell while its URL-backed analysis state
 * resolves behind Suspense.
 */
export default function GrowthPage({ searchParams }: PageProps<"/stats/growth">) {
  return (
    <Suspense fallback={<StatsExplorerPageSkeleton />}>
      <StatsExplorerRoute path="/stats/growth" searchParams={searchParams}>
        {({ periodQuery, selectedView, statsPeriod }) => (
          <Suspense fallback={<StatsExplorerSkeleton />} key={`${selectedView.id}-${periodQuery}`}>
            <GrowthMetrics statsPeriod={statsPeriod} view={selectedView} />
          </Suspense>
        )}
      </StatsExplorerRoute>
    </Suspense>
  );
}
