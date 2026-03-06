import { calculateDateRanges, formatPeriodLabel, validatePeriod } from "@zoonk/utils/date-ranges";
import { validateOffset } from "@zoonk/utils/string";
import { type Metadata } from "next";
import { Suspense } from "react";
import { AdminPeriodNavigation } from "../_components/admin-period-navigation";
import { StatsPageLayout } from "../_components/stats-page-layout";
import { ContentMetrics, ContentMetricsSkeleton } from "./content-metrics";

export const metadata: Metadata = {
  title: "Content & Operations",
};

export default async function ContentPage({ searchParams }: PageProps<"/stats/content">) {
  const { period: rawPeriod, offset: rawOffset } = await searchParams;
  const period = validatePeriod(String(rawPeriod ?? "month"));
  const offset = validateOffset(rawOffset);
  const { current } = calculateDateRanges(period, offset);
  const periodLabel = formatPeriodLabel(current.start, current.end, period, "en");

  return (
    <StatsPageLayout
      navigation={
        period === "all" ? null : (
          <AdminPeriodNavigation hasNext={offset > 0} periodLabel={periodLabel} />
        )
      }
      title="Content & Operations"
    >
      <Suspense fallback={<ContentMetricsSkeleton />} key={`${period}-${offset}`}>
        <ContentMetrics searchParams={searchParams} />
      </Suspense>
    </StatsPageLayout>
  );
}
