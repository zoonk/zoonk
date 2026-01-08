import { FeatureCardSectionTitle } from "@zoonk/ui/components/feature";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cacheLife } from "next/cache";
import { getExtracted } from "next-intl/server";
import { getEnergyLevel } from "@/data/progress/get-energy-level";
import { EnergyLevel, EnergyLevelSkeleton } from "./energy-level";

export async function Performance() {
  "use cache: private";
  cacheLife("minutes");

  const t = await getExtracted();
  const energyData = await getEnergyLevel();

  if (!energyData) {
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

      <div className="flex flex-wrap gap-4 px-4">
        <EnergyLevel energy={energyData.currentEnergy} />
      </div>
    </section>
  );
}

export function PerformanceSkeleton() {
  return (
    <section className="flex flex-col gap-3 py-4 md:py-6">
      <Skeleton className="mx-4 h-5 w-24" />

      <div className="flex flex-wrap gap-4 px-4">
        <EnergyLevelSkeleton />
      </div>
    </section>
  );
}
