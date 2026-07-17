import { countContent } from "@/data/stats/count-content";
import { getDailyContentCreated } from "@/data/stats/get-daily-content-created";
import { getPeriodContentCreated } from "@/data/stats/get-period-content-created";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";
import { BookOpenIcon, LayersIcon } from "lucide-react";
import { Suspense } from "react";
import { AdminMetricCard, AdminMetricCardSkeleton } from "../_components/admin-metric-card";
import { type StatsPeriod } from "../_utils/stats-period";
import { CompletedLessonsByKindTable } from "./completed-lessons-by-kind-table";
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

export async function ContentMetrics({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  "use cache: private";

  const { current, period, previous } = statsPeriod;

  const [currentCreated, previousCreated, totals] = await Promise.all([
    getPeriodContentCreated(current.start, current.end),
    getPeriodContentCreated(previous.start, previous.end),
    countContent(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
        <AdminMetricCard
          change={{ current: currentCreated.courses, period, previous: previousCreated.courses }}
          help="Courses created during the selected period"
          icon={<BookOpenIcon />}
          title="New Courses"
          value={currentCreated.courses.toLocaleString()}
        />

        <AdminMetricCard
          change={{ current: currentCreated.lessons, period, previous: previousCreated.lessons }}
          help="Completed-generation lessons created during the selected period"
          icon={<LayersIcon />}
          title="New Lessons"
          value={currentCreated.lessons.toLocaleString()}
        />
      </div>

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <ContentChartSection end={current.end} period={period} start={current.start} />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-semibold tracking-tight">Content Totals</h3>

          <div className="rounded-lg border">
            <ContentTotalsTable periodCreated={currentCreated} totals={totals} />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-base font-semibold tracking-tight">Completed Lessons by Kind</h3>

          <div className="rounded-lg border">
            <CompletedLessonsByKindTable lessonsByKind={totals.completedLessonsByKind} />
          </div>
        </section>
      </div>
    </div>
  );
}

export function ContentMetricsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
        <AdminMetricCardSkeleton />
        <AdminMetricCardSkeleton />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    </div>
  );
}
