import { MAX_ENERGY } from "@zoonk/core/progress/energy";
import {
  ProgressIndicator,
  ProgressLabel,
  ProgressRoot,
  ProgressTrack,
} from "@zoonk/ui/components/progress";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { formatMetricPercent } from "@zoonk/utils/number";
import { BatteryChargingIcon, BatteryFullIcon } from "lucide-react";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";

/** Turns the live Energy value into a clear, accessible path toward the 100% goal. */
export async function EnergyStats({ currentEnergy }: { currentEnergy: number }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const locale = await getLocale();

  const formattedCurrentEnergy = formatMetricPercent({ format, value: currentEnergy });
  const isFullEnergy = currentEnergy >= MAX_ENERGY;
  const EnergyStatusIcon = isFullEnergy ? BatteryFullIcon : BatteryChargingIcon;

  return (
    <ProgressRoot
      aria-valuetext={formattedCurrentEnergy}
      className="flex-col gap-4"
      locale={locale}
      max={MAX_ENERGY}
      value={currentEnergy}
    >
      <div className="flex w-full items-end justify-between gap-4">
        <ProgressLabel className="text-muted-foreground">{t("Your Energy")}</ProgressLabel>
        <span aria-hidden className="text-energy text-5xl font-bold tracking-tight tabular-nums">
          {formattedCurrentEnergy}
        </span>
      </div>

      <div className="text-energy flex w-full items-center gap-3">
        <EnergyStatusIcon aria-hidden className="size-9 shrink-0" />
        <ProgressTrack className="bg-energy/10 ring-energy/30 h-9 rounded-xl ring-2 ring-inset">
          <ProgressIndicator className="animate-energy-charge bg-energy origin-left rounded-xl motion-reduce:animate-none" />
        </ProgressTrack>
      </div>
    </ProgressRoot>
  );
}

/** Reserves the battery's final dimensions while private Energy data streams. */
export function EnergyStatsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-28" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="h-9 flex-1 rounded-xl" />
      </div>
    </div>
  );
}
