import { type Metadata } from "next";
import { Suspense } from "react";
import { AdminPeriodNavigation } from "../_components/admin-period-navigation";
import { StatsPageLayout, StatsPeriodNavigationSkeleton } from "../_components/stats-page-layout";
import { getStatsPeriod } from "../_utils/stats-period";
import { EngagementMetrics, EngagementMetricsSkeleton } from "./engagement-metrics";
import { LearnerMilestones, LearnerMilestonesSkeleton } from "./learner-milestones";

export const metadata: Metadata = { title: "Engagement & Learning" };

/**
 * Stable analytics chrome stays in the App Shell while period metrics and
 * learner milestones resolve in independent boundaries.
 */
export default function EngagementPage({ searchParams }: PageProps<"/stats/engagement">) {
  return (
    <StatsPageLayout
      navigation={
        <Suspense fallback={<StatsPeriodNavigationSkeleton />}>
          <EngagementPeriodNavigation searchParams={searchParams} />
        </Suspense>
      }
      title="Engagement & Learning"
    >
      <div className="flex flex-col gap-8">
        <Suspense fallback={<EngagementMetricsSkeleton />}>
          <EngagementMetricsRegion searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<LearnerMilestonesSkeleton />}>
          <LearnerMilestonesRegion searchParams={searchParams} />
        </Suspense>
      </div>
    </StatsPageLayout>
  );
}

/**
 * Runtime prefetching can resolve the selected period before navigation while
 * the shared title and breadcrumbs remain available from the route shell.
 */
async function EngagementPeriodNavigation({
  searchParams,
}: Pick<PageProps<"/stats/engagement">, "searchParams">) {
  const [params, { offset, period, periodLabel }] = await Promise.all([
    searchParams,
    getStatsPeriod(searchParams),
  ]);

  return period === "all" ? null : (
    <AdminPeriodNavigation
      basePath="/stats/engagement"
      offset={offset}
      period={period}
      periodLabel={periodLabel}
      queryParams={params}
    />
  );
}

/**
 * The URL and cached calendar range resolve before the private analytics query.
 * The keyed inner boundary resets only the metric body when the period changes.
 */
async function EngagementMetricsRegion({
  searchParams,
}: Pick<PageProps<"/stats/engagement">, "searchParams">) {
  const statsPeriod = await getStatsPeriod(searchParams);

  return (
    <Suspense
      fallback={<EngagementMetricsSkeleton />}
      key={`${statsPeriod.period}-${statsPeriod.offset}`}
    >
      <EngagementMetrics statsPeriod={statsPeriod} />
    </Suspense>
  );
}

/**
 * Milestone thresholds are independent from the selected calendar period, so
 * their URL read and cached aggregate should stream in parallel with metrics.
 */
async function LearnerMilestonesRegion({
  searchParams,
}: Pick<PageProps<"/stats/engagement">, "searchParams">) {
  return <LearnerMilestones searchParams={await searchParams} />;
}
