import { calculateDateRanges, formatPeriodLabel, validatePeriod } from "@zoonk/utils/date-ranges";
import { validateOffset } from "@zoonk/utils/number";
import { type Metadata } from "next";
import { Suspense } from "react";
import { AdminPeriodNavigation } from "../_components/admin-period-navigation";
import { StatsPageLayout } from "../_components/stats-page-layout";
import { EngagementMetrics, EngagementMetricsSkeleton } from "./engagement-metrics";
import { LearnerMilestones, LearnerMilestonesSkeleton } from "./learner-milestones";

export const metadata: Metadata = { title: "Engagement & Learning" };

export default async function EngagementPage({ searchParams }: PageProps<"/stats/engagement">) {
  const params = await searchParams;
  const { period: rawPeriod, offset: rawOffset } = params;
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
      title="Engagement & Learning"
    >
      <div className="flex flex-col gap-8">
        <Suspense fallback={<EngagementMetricsSkeleton />} key={`${period}-${offset}`}>
          <EngagementMetrics searchParams={params} />
        </Suspense>

        <Suspense fallback={<LearnerMilestonesSkeleton />}>
          <LearnerMilestones searchParams={params} />
        </Suspense>
      </div>
    </StatsPageLayout>
  );
}
