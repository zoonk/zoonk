import { type Metadata } from "next";
import { Suspense } from "react";
import {
  StatsExplorerPageSkeleton,
  StatsExplorerSkeleton,
} from "../_components/stats-explorer-layout";
import { StatsExplorerRoute } from "../_components/stats-explorer-route";
import { ContentMetrics } from "./content-metrics";

export const metadata: Metadata = { title: "Content Stats" };

/**
 * Content keeps an instant route shell while its URL-backed analysis state
 * resolves behind Suspense.
 */
export default function ContentPage({ searchParams }: PageProps<"/stats/content">) {
  return (
    <Suspense fallback={<StatsExplorerPageSkeleton />}>
      <StatsExplorerRoute path="/stats/content" searchParams={searchParams}>
        {({ periodQuery, selectedView, statsPeriod }) => (
          <Suspense fallback={<StatsExplorerSkeleton />} key={`${selectedView.id}-${periodQuery}`}>
            <ContentMetrics statsPeriod={statsPeriod} view={selectedView} />
          </Suspense>
        )}
      </StatsExplorerRoute>
    </Suspense>
  );
}
