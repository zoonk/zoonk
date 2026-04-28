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
const DAYS_30 = 30;

export async function EngagementStats() {
  await connection();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - DAYS_7);
  const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - DAYS_30);

  const [
    activeLearners,
    accuracyRate,
    avgTime,
    avgLessonsPerLearner,
    completionRate,
    totalLearningTime,
  ] = await Promise.all([
    countActiveLearners(sevenDaysAgo, thirtyDaysAgo),
    getAccuracyRate(),
    getAvgLessonTime(),
    getAvgLessonsPerLearner(),
    getCompletionRate(),
    getTotalLearningTime(),
  ]);

  return (
    <StatsSection subtitle="How learners interact with content" title="Engagement & Learning">
      <Stats
        description={`vs ${activeLearners.last30Days.toLocaleString()} in last 30d`}
        help="Users with activity in the last 7 days"
        href="/stats/engagement"
        icon={<BookOpenIcon />}
        title="Active Learners (7d)"
        value={activeLearners.last7Days.toLocaleString()}
      />

      <Stats
        help="Correct answers vs total attempts"
        href="/stats/engagement"
        icon={<TargetIcon />}
        title="Accuracy Rate"
        value={`${accuracyRate.toFixed(1)}%`}
      />

      <Stats
        help="Lessons completed vs started"
        href="/stats/engagement"
        icon={<CheckCircleIcon />}
        title="Completion Rate"
        value={`${completionRate.toFixed(1)}%`}
      />

      <Stats
        help="Average time to complete a lesson"
        href="/stats/engagement"
        icon={<ClockIcon />}
        title="Avg Time / Lesson"
        value={formatDuration(avgTime)}
      />

      <Stats
        help="Average lessons completed per active learner"
        icon={<LayersIcon />}
        title="Lessons / Learner"
        value={avgLessonsPerLearner.toLocaleString()}
      />

      <Stats
        help="Cumulative time spent learning on the platform"
        icon={<ClockIcon />}
        title="Total Learning Time"
        value={formatDuration(totalLearningTime)}
      />
    </StatsSection>
  );
}
