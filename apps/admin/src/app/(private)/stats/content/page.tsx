import { type Metadata } from "next";
import { Suspense } from "react";
import { StatsPageLayout } from "../_components/stats-page-layout";
import { ContentMetrics, ContentMetricsSkeleton } from "./content-metrics";

export const metadata: Metadata = {
  title: "Content & Operations",
};

export default async function ContentPage({ searchParams }: PageProps<"/stats/content">) {
  const { period } = await searchParams;

  return (
    <StatsPageLayout title="Content & Operations">
      <Suspense fallback={<ContentMetricsSkeleton />} key={String(period)}>
        <ContentMetrics searchParams={searchParams} />
      </Suspense>
    </StatsPageLayout>
  );
}
