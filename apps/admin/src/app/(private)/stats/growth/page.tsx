import { type Metadata } from "next";
import { Suspense } from "react";
import { AdminPeriodNavigation } from "../_components/admin-period-navigation";
import { StatsPageLayout, StatsPeriodNavigationSkeleton } from "../_components/stats-page-layout";
import { getStatsPeriod } from "../_utils/stats-period";
import { GrowthMetrics, GrowthMetricsSkeleton } from "./growth-metrics";

export const metadata: Metadata = { title: "Growth & Sustainability" };
export const prefetch = "allow-runtime";

/**
 * Stable analytics chrome stays in the App Shell while URL-backed controls and
 * cached metrics resolve in independent boundaries.
 */
export default function GrowthPage({ searchParams }: PageProps<"/stats/growth">) {
  return (
    <StatsPageLayout
      navigation={
        <Suspense fallback={<StatsPeriodNavigationSkeleton />}>
          <GrowthPeriodNavigation searchParams={searchParams} />
        </Suspense>
      }
      title="Growth & Sustainability"
    >
      <Suspense fallback={<GrowthMetricsSkeleton />}>
        <GrowthMetricsRegion searchParams={searchParams} />
      </Suspense>
    </StatsPageLayout>
  );
}

/**
 * Runtime prefetching can resolve the selected period before navigation while
 * the shared title and breadcrumbs remain available from the route shell.
 */
async function GrowthPeriodNavigation({
  searchParams,
}: Pick<PageProps<"/stats/growth">, "searchParams">) {
  const { offset, period, periodLabel } = await getStatsPeriod(searchParams);

  return period === "all" ? null : (
    <AdminPeriodNavigation
      basePath="/stats/growth"
      offset={offset}
      period={period}
      periodLabel={periodLabel}
    />
  );
}

/**
 * The URL and cached calendar range resolve before the private analytics query.
 * The keyed inner boundary resets only the metric body when the period changes.
 */
async function GrowthMetricsRegion({
  searchParams,
}: Pick<PageProps<"/stats/growth">, "searchParams">) {
  const statsPeriod = await getStatsPeriod(searchParams);

  return (
    <Suspense
      fallback={<GrowthMetricsSkeleton />}
      key={`${statsPeriod.period}-${statsPeriod.offset}`}
    >
      <GrowthMetrics statsPeriod={statsPeriod} />
    </Suspense>
  );
}
