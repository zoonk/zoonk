import { type Metadata } from "next";
import { Suspense } from "react";
import { StatsPageLayout } from "../_components/stats-page-layout";
import { GrowthMetrics, GrowthMetricsSkeleton } from "./growth-metrics";

export const metadata: Metadata = {
  title: "Growth & Sustainability",
};

export default async function GrowthPage({ searchParams }: PageProps<"/stats/growth">) {
  const { period } = await searchParams;

  return (
    <StatsPageLayout title="Growth & Sustainability">
      <Suspense fallback={<GrowthMetricsSkeleton />} key={String(period)}>
        <GrowthMetrics searchParams={searchParams} />
      </Suspense>
    </StatsPageLayout>
  );
}
