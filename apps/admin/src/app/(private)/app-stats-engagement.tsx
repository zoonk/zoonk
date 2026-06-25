import { Stats } from "@/components/stats";
import { StatsSection } from "@/components/stats-section";
import { countActiveLearners } from "@/data/stats/count-active-learners";
import { getAccuracyRate } from "@/data/stats/get-accuracy-rate";
import { getAvgLessonTime } from "@/data/stats/get-avg-lesson-time";
import { getAvgLessonsPerLearner } from "@/data/stats/get-avg-lessons-per-learner";
import { getCompletionRate } from "@/data/stats/get-completion-rate";
import { getTotalLearningTime } from "@/data/stats/get-total-learning-time";
import { formatDuration } from "@/lib/format-duration";
import { BookOpenIcon, CheckCircleIcon, ClockIcon, LayersIcon, TargetIcon } from "lucide-react";
import { connection } from "next/server";

const DAYS_7 = 7;

/**
 * Dashboard comparisons use whole UTC dates because the source table stores a
 * date-only learning day instead of a timestamp.
 */
function startOfUtcToday(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Date math is kept in one helper so the current and previous 7-day windows
 * stay the same length when the dashboard card builds its comparison.
 */
function addUtcDays({ date, days }: { date: Date; days: number }) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

/**
 * The current 7-day window includes today and the 6 preceding calendar days;
 * the previous window is the 7 calendar days immediately before that.
 */
function getActiveLearnerWindows(now: Date) {
  const today = startOfUtcToday(now);
  const currentPeriodStart = addUtcDays({ date: today, days: 1 - DAYS_7 });
  const previousPeriodStart = addUtcDays({ date: currentPeriodStart, days: -DAYS_7 });

  return { currentPeriodStart, previousPeriodStart };
}

export async function EngagementStats() {
  await connection();
  const now = new Date();
  const { currentPeriodStart, previousPeriodStart } = getActiveLearnerWindows(now);

  const [
    activeLearners,
    accuracyRate,
    avgTime,
    avgLessonsPerLearner,
    completionRate,
    totalLearningTime,
  ] = await Promise.all([
    countActiveLearners({ currentPeriodStart, previousPeriodStart }),
    getAccuracyRate(),
    getAvgLessonTime(),
    getAvgLessonsPerLearner(),
    getCompletionRate(),
    getTotalLearningTime(),
  ]);

  return (
    <StatsSection subtitle="How learners interact with content" title="Engagement & Learning">
      <Stats
        description={`vs ${activeLearners.previousPeriod.toLocaleString()} in previous 7d`}
        help="Users who completed at least 1 lesson in the last 7 days"
        href="/stats/engagement"
        icon={<BookOpenIcon />}
        title="Active Learners (7d)"
        value={activeLearners.currentPeriod.toLocaleString()}
      />

      <Stats
        help="Correct step answers divided by all step attempts"
        href="/stats/engagement"
        icon={<TargetIcon />}
        title="Accuracy Rate"
        value={`${accuracyRate.toFixed(1)}%`}
      />

      <Stats
        help="Completed lessons divided by lessons users started"
        href="/stats/engagement"
        icon={<CheckCircleIcon />}
        title="Completion Rate"
        value={`${completionRate.toFixed(1)}%`}
      />

      <Stats
        help="Average recorded duration for completed lessons"
        href="/stats/engagement"
        icon={<ClockIcon />}
        title="Avg Time / Lesson"
        value={formatDuration(avgTime)}
      />

      <Stats
        help="Completed lessons divided by learners who completed at least 1 lesson"
        icon={<LayersIcon />}
        title="Lessons / Learner"
        value={avgLessonsPerLearner.toLocaleString()}
      />

      <Stats
        help="Total recorded lesson time across all learners"
        icon={<ClockIcon />}
        title="Total Learning Time"
        value={formatDuration(totalLearningTime)}
      />
    </StatsSection>
  );
}
