import { loadOptionalData } from "@/data/_utils/load-optional-data";
import { getCurrentUserProgress } from "@zoonk/core/progress/get-current-user";
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
  const progress = await loadOptionalData(getCurrentUserProgress);

  if (!progress?.level) {
    return null;
  }

  const t = await getExtracted();

  return (
    <section aria-labelledby={PROGRESS_TITLE_ID} className="flex flex-col gap-3 py-4 md:py-6">
      <FeatureCardSectionTitle className="px-4" id={PROGRESS_TITLE_ID}>
        {t("Progress")}
      </FeatureCardSectionTitle>

      <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
        {progress.energy && <Energy energy={progress.energy.currentEnergy} />}

        <Level
          bpToNextLevel={progress.level.bpToNextLevel}
          color={progress.level.color}
          isMaxLevel={progress.level.isMaxLevel}
          level={progress.level.level}
        />

        <CompletedLessons completedLessons={progress.activity.totalLessonCompletions} />
        <LearningDays learningDays={progress.activity.learningDays} />
        <LearningTime totalLearningSeconds={progress.activity.totalLearningSeconds} />

        {progress.score && <Score score={progress.score.score} />}

        {progress.scorePatterns?.strongestWeekday && (
          <BestDay
            dayOfWeek={progress.scorePatterns.strongestWeekday.dayOfWeek}
            score={progress.scorePatterns.strongestWeekday.score}
          />
        )}

        {progress.scorePatterns?.strongestTime && (
          <BestTime
            period={progress.scorePatterns.strongestTime.period}
            score={progress.scorePatterns.strongestTime.score}
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
