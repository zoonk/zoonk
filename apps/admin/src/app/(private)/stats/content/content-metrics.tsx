import { countContent } from "@/data/stats/count-content";
import { countTotalPendingReviews } from "@/data/stats/count-total-pending-reviews";
import { getPeriodContentCreated } from "@/data/stats/get-period-content-created";
import { getPeriodReviewsResolved } from "@/data/stats/get-period-reviews-resolved";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { calculateDateRanges, validatePeriod } from "@zoonk/utils/date-ranges";
import { AlertCircleIcon, BookOpenIcon, CheckCircleIcon, LayersIcon } from "lucide-react";
import { AdminMetricCard, AdminMetricCardSkeleton } from "../_components/admin-metric-card";
import { ContentTotalsTable } from "./content-totals-table";

export async function ContentMetrics({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const period = validatePeriod(rawPeriod ?? "month");
  const { current, previous } = calculateDateRanges(period, 0);

  const [currentCreated, previousCreated, currentReviews, previousReviews, pendingReviews, totals] =
    await Promise.all([
      getPeriodContentCreated(current.start, current.end),
      getPeriodContentCreated(previous.start, previous.end),
      getPeriodReviewsResolved(current.start, current.end),
      getPeriodReviewsResolved(previous.start, previous.end),
      countTotalPendingReviews(),
      countContent(),
    ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
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

        <AdminMetricCard
          change={{ current: currentReviews, period, previous: previousReviews }}
          help="Content reviews completed in this period"
          icon={<CheckCircleIcon />}
          title="Reviews Resolved"
          value={currentReviews.toLocaleString()}
        />

        <AdminMetricCard
          help="Content awaiting admin review"
          icon={<AlertCircleIcon />}
          title="Pending Reviews"
          value={pendingReviews.toLocaleString()}
        />
      </div>

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
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        <AdminMetricCardSkeleton />
        <AdminMetricCardSkeleton />
        <AdminMetricCardSkeleton />
        <AdminMetricCardSkeleton />
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}
