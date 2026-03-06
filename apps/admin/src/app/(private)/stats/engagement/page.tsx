import { calculateDateRanges, formatPeriodLabel, validatePeriod } from "@zoonk/utils/date-ranges";
import { type Metadata } from "next";
import { Suspense } from "react";
import { AdminPeriodNavigation } from "../_components/admin-period-navigation";
import { StatsPageLayout } from "../_components/stats-page-layout";
import { EngagementMetrics, EngagementMetricsSkeleton } from "./engagement-metrics";

export const metadata: Metadata = {
  title: "Engagement & Learning",
};

export default async function EngagementPage({ searchParams }: PageProps<"/stats/engagement">) {
  const { period: rawPeriod, offset: rawOffset } = await searchParams;
  const period = validatePeriod(String(rawPeriod ?? "month"));
  const offset = Number(rawOffset) || 0;
  const { current } = calculateDateRanges(period, offset);
  const periodLabel = formatPeriodLabel(current.start, current.end, period, "en");

  return (
    <StatsPageLayout
      navigation={
        period === "all" ? null : (
          <AdminPeriodNavigation hasNext={offset > 0} periodLabel={periodLabel} />
        )
      }
      title="Engagement & Learning"
    >
      <Suspense fallback={<EngagementMetricsSkeleton />} key={`${period}-${offset}`}>
        <EngagementMetrics searchParams={searchParams} />
      </Suspense>
    </StatsPageLayout>
  );
}
