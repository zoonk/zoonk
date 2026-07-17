import { type Metadata } from "next";
import { Suspense } from "react";
import { AdminPeriodNavigation } from "../_components/admin-period-navigation";
import { StatsPageLayout, StatsPeriodNavigationSkeleton } from "../_components/stats-page-layout";
import { getStatsPeriod } from "../_utils/stats-period";
import { ContentMetrics, ContentMetricsSkeleton } from "./content-metrics";

export const metadata: Metadata = { title: "Content & Operations" };

/**
 * Stable analytics chrome stays in the App Shell while URL-backed controls and
 * cached metrics resolve in independent boundaries.
 */
export default function ContentPage({ searchParams }: PageProps<"/stats/content">) {
  return (
    <StatsPageLayout
      navigation={
        <Suspense fallback={<StatsPeriodNavigationSkeleton />}>
          <ContentPeriodNavigation searchParams={searchParams} />
        </Suspense>
      }
      title="Content & Operations"
    >
      <Suspense fallback={<ContentMetricsSkeleton />}>
        <ContentMetricsRegion searchParams={searchParams} />
      </Suspense>
    </StatsPageLayout>
  );
}

/**
 * Runtime prefetching can resolve the selected period before navigation while
 * the shared title and breadcrumbs remain available from the route shell.
 */
async function ContentPeriodNavigation({
  searchParams,
}: Pick<PageProps<"/stats/content">, "searchParams">) {
  const { offset, period, periodLabel } = await getStatsPeriod(searchParams);

  return period === "all" ? null : (
    <AdminPeriodNavigation
      basePath="/stats/content"
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
async function ContentMetricsRegion({
  searchParams,
}: Pick<PageProps<"/stats/content">, "searchParams">) {
  const statsPeriod = await getStatsPeriod(searchParams);

  return (
    <Suspense
      fallback={<ContentMetricsSkeleton />}
      key={`${statsPeriod.period}-${statsPeriod.offset}`}
    >
      <ContentMetrics statsPeriod={statsPeriod} />
    </Suspense>
  );
}
