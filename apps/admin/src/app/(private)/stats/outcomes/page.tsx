import { type Metadata } from "next";
import { Suspense } from "react";
import {
  StatsExplorerPageSkeleton,
  StatsExplorerSkeleton,
} from "../_components/stats-explorer-layout";
import { StatsExplorerRoute } from "../_components/stats-explorer-route";
import { OutcomeMetrics } from "./outcome-metrics";

export const metadata: Metadata = { title: "Outcome Stats" };

/** Outcomes: goals reached, mock exams, checkpoints and official exam results. */
export default function OutcomesPage({ searchParams }: PageProps<"/stats/outcomes">) {
  return (
    <Suspense fallback={<StatsExplorerPageSkeleton />}>
      <StatsExplorerRoute path="/stats/outcomes" searchParams={searchParams}>
        {({ periodQuery, selectedView, statsPeriod }) => (
          <Suspense fallback={<StatsExplorerSkeleton />} key={`${selectedView.id}-${periodQuery}`}>
            <OutcomeMetrics statsPeriod={statsPeriod} view={selectedView} />
          </Suspense>
        )}
      </StatsExplorerRoute>
    </Suspense>
  );
}
