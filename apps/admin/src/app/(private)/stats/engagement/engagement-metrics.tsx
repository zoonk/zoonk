import { getAvgTimeByLessonKind } from "@/data/stats/get-avg-time-by-lesson-kind";
import { getDailyActiveLearners } from "@/data/stats/get-daily-active-learners";
import { getPeriodAccuracyRate } from "@/data/stats/get-period-accuracy-rate";
import { getPeriodActiveLearners } from "@/data/stats/get-period-active-learners";
import { getPeriodAvgLessonTime } from "@/data/stats/get-period-avg-lesson-time";
import { getPeriodCompletionRate } from "@/data/stats/get-period-completion-rate";
import { getPeriodLearningTime } from "@/data/stats/get-period-learning-time";
import { formatDuration } from "@/lib/format-duration";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { buildChartData } from "@zoonk/utils/chart";
import { BookOpenIcon, CheckCircleIcon, ClockIcon, TargetIcon, TimerIcon } from "lucide-react";
import { AdminMetricCard, AdminMetricCardSkeleton } from "../_components/admin-metric-card";
import { AdminTrendChart } from "../_components/admin-trend-chart";
import { type StatsPeriod } from "../_utils/stats-period";
import { LessonBreakdownTable } from "./lesson-breakdown-table";

export async function EngagementMetrics({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  "use cache: private";

  const { current, period, previous } = statsPeriod;

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
    lessonBreakdown,
  ] = await Promise.all([
    getPeriodActiveLearners(current.start, current.end),
    getPeriodActiveLearners(previous.start, previous.end),
    getPeriodAccuracyRate(current.start, current.end),
    getPeriodAccuracyRate(previous.start, previous.end),
    getPeriodAvgLessonTime(current.start, current.end),
    getPeriodAvgLessonTime(previous.start, previous.end),
    getPeriodCompletionRate(current.start, current.end),
    getPeriodCompletionRate(previous.start, previous.end),
    getPeriodLearningTime(current.start, current.end),
    getPeriodLearningTime(previous.start, previous.end),
    getDailyActiveLearners(current.start, current.end),
    getAvgTimeByLessonKind(current.start, current.end),
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
          help="Users who completed at least 1 lesson in the selected period"
          icon={<BookOpenIcon />}
          title="Active Learners"
          value={currentActiveLearners.toLocaleString()}
        />

        <AdminMetricCard
          change={{ current: currentAccuracy, period, previous: previousAccuracy }}
          help="Correct step answers divided by all step attempts"
          icon={<TargetIcon />}
          title="Accuracy Rate"
          value={`${currentAccuracy.toFixed(1)}%`}
        />

        <AdminMetricCard
          change={{ current: currentCompletionRate, period, previous: previousCompletionRate }}
          help="Completed lessons divided by lessons users started"
          icon={<CheckCircleIcon />}
          title="Completion Rate"
          value={`${currentCompletionRate.toFixed(1)}%`}
        />

        <AdminMetricCard
          change={{ current: currentAvgTime, period, previous: previousAvgTime }}
          help="Average recorded duration for completed lessons"
          icon={<ClockIcon />}
          title="Avg Time / Lesson"
          value={formatDuration(currentAvgTime)}
        />

        <AdminMetricCard
          change={{ current: currentLearningTime, period, previous: previousLearningTime }}
          help="Total recorded lesson time in the selected period"
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

      {lessonBreakdown.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold tracking-tight">Lesson Time Breakdown</h3>

          <div className="rounded-lg border">
            <LessonBreakdownTable data={lessonBreakdown} />
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
