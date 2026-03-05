import { countContent } from "@/data/stats/count-content";
import { getDailyContentCreated } from "@/data/stats/get-daily-content-created";
import { getPeriodContentCreated } from "@/data/stats/get-period-content-created";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type HistoryPeriod, calculateDateRanges, validatePeriod } from "@zoonk/utils/date-ranges";
import { BookOpenIcon, LayersIcon } from "lucide-react";
import { Suspense } from "react";
import { AdminMetricCard, AdminMetricCardSkeleton } from "../_components/admin-metric-card";
import { ContentChart } from "./content-chart-filter";
import { ContentTotalsTable } from "./content-totals-table";

async function ContentChartSection({
  start,
  end,
  period,
}: {
  start: Date;
  end: Date;
  period: HistoryPeriod;
}) {
  const dailyContent = await getDailyContentCreated(start, end);
  return <ContentChart dailyContent={dailyContent} period={period} />;
}

export async function ContentMetrics({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const period = validatePeriod(rawPeriod ?? "month");
  const { current, previous } = calculateDateRanges(period, 0);

  const [currentCreated, previousCreated, totals] = await Promise.all([
    getPeriodContentCreated(current.start, current.end),
    getPeriodContentCreated(previous.start, previous.end),
    countContent(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <AdminMetricCard
          change={{ current: currentCreated.courses, period, previous: previousCreated.courses }}
          help="Courses created in this period"
          icon={<BookOpenIcon />}
          title="New Courses"
          value={currentCreated.courses.toLocaleString()}
        />

        <AdminMetricCard
          change={{ current: currentCreated.lessons, period, previous: previousCreated.lessons }}
          help="Lessons created in this period"
          icon={<LayersIcon />}
          title="New Lessons"
          value={currentCreated.lessons.toLocaleString()}
        />
      </div>

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <ContentChartSection end={current.end} period={period} start={current.start} />
      </Suspense>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold tracking-tight">Content Totals</h3>

        <div className="rounded-lg border">
          <ContentTotalsTable periodCreated={currentCreated} totals={totals} />
        </div>
      </div>
    </div>
  );
}

export function ContentMetricsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <AdminMetricCardSkeleton />
        <AdminMetricCardSkeleton />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}
