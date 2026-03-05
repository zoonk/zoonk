import { type Metadata } from "next";
import { Suspense } from "react";
import { StatsPageLayout } from "../_components/stats-page-layout";
import { EngagementMetrics, EngagementMetricsSkeleton } from "./engagement-metrics";

export const metadata: Metadata = {
  title: "Engagement & Learning",
};

export default async function EngagementPage({ searchParams }: PageProps<"/stats/engagement">) {
  const { period } = await searchParams;

  return (
    <StatsPageLayout title="Engagement & Learning">
      <Suspense fallback={<EngagementMetricsSkeleton />} key={String(period)}>
        <EngagementMetrics searchParams={searchParams} />
      </Suspense>
    </StatsPageLayout>
  );
}
