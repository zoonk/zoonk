import { FeatureCardSectionTitle } from "@zoonk/ui/components/feature";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cacheLife } from "next/cache";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { getBeltLevel } from "@/data/progress/get-belt-level";
import { getEnergyLevel } from "@/data/progress/get-energy-level";
import { BeltLevel, BeltLevelSkeleton } from "./belt-level";
import { EnergyLevel, EnergyLevelSkeleton } from "./energy-level";

export async function Performance({ locale }: { locale: string }) {
  "use cache: private";
  cacheLife("minutes");
  setRequestLocale(locale);

  const t = await getExtracted();

  const [energyData, beltData] = await Promise.all([
    getEnergyLevel(),
    getBeltLevel(),
  ]);

  if (!(energyData && beltData)) {
    return null;
  }

  return (
    <section
      aria-labelledby="performance-title"
      className="flex flex-col gap-3 py-4 md:py-6"
    >
      <FeatureCardSectionTitle className="px-4" id="performance-title">
        {t("Performance")}
      </FeatureCardSectionTitle>

      <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        <EnergyLevel energy={energyData.currentEnergy} />
        <BeltLevel
          bpToNextLevel={beltData.bpToNextLevel}
          color={beltData.color}
          isMaxLevel={beltData.isMaxLevel}
          level={beltData.level}
        />
      </div>
    </section>
  );
}

export function PerformanceSkeleton() {
  return (
    <section className="flex flex-col gap-3 py-4 md:py-6">
      <Skeleton className="mx-4 h-5 w-24" />

      <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        <EnergyLevelSkeleton />
        <BeltLevelSkeleton />
      </div>
    </section>
  );
}
