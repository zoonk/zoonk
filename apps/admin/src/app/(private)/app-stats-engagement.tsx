import { Stats } from "@/components/stats";
import { StatsSection } from "@/components/stats-section";
import { countActiveLearners } from "@/data/stats/count-active-learners";
import { getAccuracyRate } from "@/data/stats/get-accuracy-rate";
import { getAvgLessonTime } from "@/data/stats/get-avg-lesson-time";
import { getAvgLessonsPerLearner } from "@/data/stats/get-avg-lessons-per-learner";
import { getCompletionRate } from "@/data/stats/get-completion-rate";
import { getTotalLearningTime } from "@/data/stats/get-total-learning-time";
import { formatDuration } from "@/lib/format-duration";
import { getRollingUtcDateWindowStarts } from "@/lib/rolling-date-windows";
import { BookOpenIcon, CheckCircleIcon, ClockIcon, LayersIcon, TargetIcon } from "lucide-react";

const DAYS_7 = 7;

export async function EngagementStats() {
  "use cache: private";

  const now = new Date();

  const { currentPeriodStart, previousPeriodStart } = getRollingUtcDateWindowStarts({
    days: DAYS_7,
    now,
  });

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
