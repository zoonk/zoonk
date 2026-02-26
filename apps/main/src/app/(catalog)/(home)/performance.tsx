import { getBeltLevel } from "@/data/progress/get-belt-level";
import { getBestDay } from "@/data/progress/get-best-day";
import { getBestTime } from "@/data/progress/get-best-time";
import { getEnergyLevel } from "@/data/progress/get-energy-level";
import { getScore } from "@/data/progress/get-score";
import { FeatureCardSectionTitle } from "@zoonk/ui/components/feature";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { BestDay, BestDaySkeleton } from "./best-day";
import { BestTime, BestTimeSkeleton } from "./best-time";
import { Energy, EnergySkeleton } from "./energy";
import { Level, LevelSkeleton } from "./level";
import { Score, ScoreSkeleton } from "./score";

export async function Performance() {
  const t = await getExtracted();

  const [energyData, beltData, scoreData, bestDayData, bestTimeData] = await Promise.all([
    getEnergyLevel(),
    getBeltLevel(),
    getScore(),
    getBestDay(),
    getBestTime(),
  ]);

  return (
    <section aria-labelledby="performance-title" className="flex flex-col gap-3 py-4 md:py-6">
      <FeatureCardSectionTitle className="px-4" id="performance-title">
        {t("Performance")}
      </FeatureCardSectionTitle>

      <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {energyData && <Energy energy={energyData.currentEnergy} />}

        {beltData && (
          <Level
            bpToNextLevel={beltData.bpToNextLevel}
            color={beltData.color}
            isMaxLevel={beltData.isMaxLevel}
            level={beltData.level}
          />
        )}

        {scoreData && <Score score={scoreData.score} />}

        {bestDayData && <BestDay dayOfWeek={bestDayData.dayOfWeek} score={bestDayData.score} />}

        {bestTimeData && <BestTime period={bestTimeData.period} score={bestTimeData.score} />}
      </div>
    </section>
  );
}

export function PerformanceSkeleton() {
  return (
    <section className="flex flex-col gap-3 py-4 md:py-6">
      <Skeleton className="mx-4 h-5 w-24" />

      <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        <EnergySkeleton />
        <LevelSkeleton />
        <ScoreSkeleton />
        <BestDaySkeleton />
        <BestTimeSkeleton />
      </div>
    </section>
  );
}
