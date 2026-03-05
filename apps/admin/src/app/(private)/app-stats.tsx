import { StatsSectionSkeleton } from "@/components/stats-section";
import { Suspense } from "react";
import { ContentStats } from "./app-stats-content";
import { EngagementStats } from "./app-stats-engagement";
import { GrowthStats } from "./app-stats-growth";

export function AppStats() {
  return (
    <div className="flex flex-col gap-12">
      <Suspense fallback={<StatsSectionSkeleton items={4} />}>
        <GrowthStats />
      </Suspense>

      <Suspense fallback={<StatsSectionSkeleton items={6} />}>
        <EngagementStats />
      </Suspense>

      <Suspense fallback={<StatsSectionSkeleton items={6} />}>
        <ContentStats />
      </Suspense>
    </div>
  );
}

export function AppStatsFallback() {
  return (
    <div className="flex flex-col gap-12">
      <StatsSectionSkeleton items={4} />
      <StatsSectionSkeleton items={6} />
      <StatsSectionSkeleton items={6} />
    </div>
  );
}
