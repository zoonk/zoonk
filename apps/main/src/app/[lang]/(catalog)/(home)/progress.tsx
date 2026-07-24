import { getBeltLevel } from "@/data/progress/get-belt-level";
import { getEnergyLevel } from "@/data/progress/get-energy-level";
import { getLearningActivityTotals } from "@/data/progress/get-learning-activity-totals";
import { getScore } from "@/data/progress/get-score";
import { getScorePatterns } from "@/data/progress/get-score-patterns";
import { FeatureCardSectionTitle } from "@zoonk/ui/components/feature";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { BestDay, BestDaySkeleton } from "./best-day";
import { BestTime, BestTimeSkeleton } from "./best-time";
import { CompletedLessons, CompletedLessonsSkeleton } from "./completed-lessons";
import { Energy, EnergySkeleton } from "./energy";
import { LearningDays, LearningDaysSkeleton } from "./learning-days";
import { LearningTime, LearningTimeSkeleton } from "./learning-time";
import { Level, LevelSkeleton } from "./level";
import { Score, ScoreSkeleton } from "./score";

const PROGRESS_TITLE_ID = "progress-title";

export async function Progress() {
  const t = await getExtracted();

  const [energyData, beltData, activityTotals, scoreData, scorePatterns] = await Promise.all([
    getEnergyLevel(),
    getBeltLevel(),
    getLearningActivityTotals(),
    getScore(),
    getScorePatterns(),
  ]);

  return (
    <section aria-labelledby={PROGRESS_TITLE_ID} className="flex flex-col gap-3 py-4 md:py-6">
      <FeatureCardSectionTitle className="px-4" id={PROGRESS_TITLE_ID}>
        {t("Progress")}
      </FeatureCardSectionTitle>

      <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
        {energyData && <Energy energy={energyData.currentEnergy} />}

        {beltData && (
          <Level
            bpToNextLevel={beltData.bpToNextLevel}
            color={beltData.color}
            isMaxLevel={beltData.isMaxLevel}
            level={beltData.level}
          />
        )}

        {activityTotals && (
          <>
            <CompletedLessons completedLessons={activityTotals.totalLessonCompletions} />
            <LearningDays learningDays={activityTotals.learningDays} />
            <LearningTime totalLearningSeconds={activityTotals.totalLearningSeconds} />
          </>
        )}

        {scoreData && <Score score={scoreData.score} />}

        {scorePatterns?.strongestWeekday && (
          <BestDay
            dayOfWeek={scorePatterns.strongestWeekday.dayOfWeek}
            score={scorePatterns.strongestWeekday.score}
          />
        )}

        {scorePatterns?.strongestTime && (
          <BestTime
            period={scorePatterns.strongestTime.period}
            score={scorePatterns.strongestTime.score}
          />
        )}
      </div>
    </section>
  );
}

export function ProgressSkeleton() {
  return (
    <section className="flex flex-col gap-3 py-4 md:py-6">
      <Skeleton className="mx-4 h-5 w-24" />

      <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
        <EnergySkeleton />
        <LevelSkeleton />
        <CompletedLessonsSkeleton />
        <LearningDaysSkeleton />
        <LearningTimeSkeleton />
        <ScoreSkeleton />
        <BestDaySkeleton />
        <BestTimeSkeleton />
      </div>
    </section>
  );
}
