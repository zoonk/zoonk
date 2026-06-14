import { getBeltLevel } from "@/data/progress/get-belt-level";
import { getBestDay } from "@/data/progress/get-best-day";
import { getBestTime } from "@/data/progress/get-best-time";
import { getEnergyLevel } from "@/data/progress/get-energy-level";
import { getScore } from "@/data/progress/get-score";
import { getTotalLearningDays } from "@/data/progress/get-total-learning-days";
import { FeatureCardSectionTitle } from "@zoonk/ui/components/feature";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { BestDay, BestDaySkeleton } from "./best-day";
import { BestTime, BestTimeSkeleton } from "./best-time";
import { Energy, EnergySkeleton } from "./energy";
import { LearningDays, LearningDaysSkeleton } from "./learning-days";
import { Level, LevelSkeleton } from "./level";
import { Score, ScoreSkeleton } from "./score";

export async function Progress() {
  const t = await getExtracted();

  const [energyData, beltData, learningDaysData, scoreData, bestDayData, bestTimeData] =
    await Promise.all([
      getEnergyLevel(),
      getBeltLevel(),
      getTotalLearningDays(),
      getScore(),
      getBestDay(),
      getBestTime(),
    ]);

  return (
    <section aria-labelledby="progress-title" className="flex flex-col gap-3 py-4 md:py-6">
      <FeatureCardSectionTitle className="px-4" id="progress-title">
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

        {learningDaysData && <LearningDays learningDays={learningDaysData.learningDays} />}

        {scoreData && <Score score={scoreData.score} />}

        {bestDayData && <BestDay dayOfWeek={bestDayData.dayOfWeek} score={bestDayData.score} />}

        {bestTimeData && <BestTime period={bestTimeData.period} score={bestTimeData.score} />}
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
        <LearningDaysSkeleton />
        <ScoreSkeleton />
        <BestDaySkeleton />
        <BestTimeSkeleton />
      </div>
    </section>
  );
}
