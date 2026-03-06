import { getAvgTimeByActivityKind } from "@/data/stats/get-avg-time-by-activity-kind";
import { getDailyActiveLearners } from "@/data/stats/get-daily-active-learners";
import { getPeriodAccuracyRate } from "@/data/stats/get-period-accuracy-rate";
import { getPeriodActiveLearners } from "@/data/stats/get-period-active-learners";
import { getPeriodAvgActivityTime } from "@/data/stats/get-period-avg-activity-time";
import { getPeriodCompletionRate } from "@/data/stats/get-period-completion-rate";
import { getPeriodLearningTime } from "@/data/stats/get-period-learning-time";
import { formatDuration } from "@/lib/format-duration";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { buildChartData, calculateDateRanges, validatePeriod } from "@zoonk/utils/date-ranges";
import { validateOffset } from "@zoonk/utils/string";
import { ActivityIcon, CheckCircleIcon, ClockIcon, TargetIcon, TimerIcon } from "lucide-react";
import { AdminMetricCard, AdminMetricCardSkeleton } from "../_components/admin-metric-card";
import { AdminTrendChart } from "../_components/admin-trend-chart";
import { ActivityBreakdownTable } from "./activity-breakdown-table";

export async function EngagementMetrics({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; offset?: string }>;
}) {
  const { period: rawPeriod, offset: rawOffset } = await searchParams;
  const period = validatePeriod(rawPeriod ?? "month");
  const offset = validateOffset(rawOffset);
  const { current, previous } = calculateDateRanges(period, offset);

  const [
    currentActiveLearners,
    previousActiveLearners,
    currentAccuracy,
    previousAccuracy,
    currentAvgTime,
    previousAvgTime,
    currentCompletionRate,
    previousCompletionRate,
    currentLearningTime,
    previousLearningTime,
    dailyActive,
    activityBreakdown,
  ] = await Promise.all([
    getPeriodActiveLearners(current.start, current.end),
    getPeriodActiveLearners(previous.start, previous.end),
    getPeriodAccuracyRate(current.start, current.end),
    getPeriodAccuracyRate(previous.start, previous.end),
    getPeriodAvgActivityTime(current.start, current.end),
    getPeriodAvgActivityTime(previous.start, previous.end),
    getPeriodCompletionRate(current.start, current.end),
    getPeriodCompletionRate(previous.start, previous.end),
    getPeriodLearningTime(current.start, current.end),
    getPeriodLearningTime(previous.start, previous.end),
    getDailyActiveLearners(current.start, current.end),
    getAvgTimeByActivityKind(current.start, current.end),
  ]);

  const { average: chartAverage, dataPoints: chartData } = buildChartData(
    dailyActive,
    period,
    "en",
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
        <AdminMetricCard
          change={{ current: currentActiveLearners, period, previous: previousActiveLearners }}
          help="Distinct users with learning activity"
          icon={<ActivityIcon />}
          title="Active Learners"
          value={currentActiveLearners.toLocaleString()}
        />

        <AdminMetricCard
          change={{ current: currentAccuracy, period, previous: previousAccuracy }}
          help="Correct answers vs total attempts"
          icon={<TargetIcon />}
          title="Accuracy Rate"
          value={`${currentAccuracy.toFixed(1)}%`}
        />

        <AdminMetricCard
          change={{ current: currentCompletionRate, period, previous: previousCompletionRate }}
          help="Activities completed vs started"
          icon={<CheckCircleIcon />}
          title="Completion Rate"
          value={`${currentCompletionRate.toFixed(1)}%`}
        />

        <AdminMetricCard
          change={{ current: currentAvgTime, period, previous: previousAvgTime }}
          help="Average time to complete an activity"
          icon={<ClockIcon />}
          title="Avg Time / Activity"
          value={formatDuration(currentAvgTime)}
        />

        <AdminMetricCard
          change={{ current: currentLearningTime, period, previous: previousLearningTime }}
          help="Total time spent learning in this period"
          icon={<TimerIcon />}
          title="Total Learning Time"
          value={formatDuration(currentLearningTime)}
        />
      </div>

      {chartData.length > 0 && (
        <AdminTrendChart
          average={chartAverage}
          dataPoints={chartData}
          valueLabel="active learners"
        />
      )}

      {activityBreakdown.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold tracking-tight">Activity Time Breakdown</h3>

          <div className="rounded-lg border">
            <ActivityBreakdownTable data={activityBreakdown} />
          </div>
        </div>
      )}
    </div>
  );
}

export function EngagementMetricsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
        <AdminMetricCardSkeleton />
        <AdminMetricCardSkeleton />
        <AdminMetricCardSkeleton />
        <AdminMetricCardSkeleton />
        <AdminMetricCardSkeleton />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}
