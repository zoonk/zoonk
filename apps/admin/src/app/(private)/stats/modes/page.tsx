import { type Metadata } from "next";
import { Suspense } from "react";
import {
  StatsExplorerPageSkeleton,
  StatsExplorerSkeleton,
} from "../_components/stats-explorer-layout";
import { StatsExplorerRoute } from "../_components/stats-explorer-route";
import { ModeComparisonAnalysis } from "./mode-comparison-analysis";

export const metadata: Metadata = { title: "Focus vs Fun" };

/** Focus against Fun for matched cohorts of learners who signed up in the selected period. */
export default function ModesPage({ searchParams }: PageProps<"/stats/modes">) {
  return (
    <Suspense fallback={<StatsExplorerPageSkeleton />}>
      <StatsExplorerRoute path="/stats/modes" searchParams={searchParams}>
        {({ periodQuery, selectedView, statsPeriod }) => (
          <Suspense fallback={<StatsExplorerSkeleton />} key={`${selectedView.id}-${periodQuery}`}>
            <ModeComparisonAnalysis statsPeriod={statsPeriod} />
          </Suspense>
        )}
      </StatsExplorerRoute>
    </Suspense>
  );
}
