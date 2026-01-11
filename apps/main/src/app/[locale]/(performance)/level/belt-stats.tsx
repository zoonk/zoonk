import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import type { BeltLevelResult } from "@zoonk/utils/belt-level";
import { getExtracted, getLocale } from "next-intl/server";
import type { HistoryPeriod } from "@/data/progress/_utils";
import { getBeltColorLabel } from "@/lib/belt-colors";
import { MetricComparison } from "../_components/metric-comparison";
import { formatPeriodLabel } from "../_utils";

export async function BeltStats({
  currentBelt,
  period,
  periodEnd,
  periodStart,
  periodTotal,
  previousPeriodTotal,
  totalBp,
}: {
  currentBelt: BeltLevelResult;
  period: HistoryPeriod;
  periodEnd: Date;
  periodStart: Date;
  periodTotal: number;
  previousPeriodTotal: number | null;
  totalBp: number;
}) {
  const t = await getExtracted();
  const locale = await getLocale();

  const formattedTotalBp = new Intl.NumberFormat(locale).format(totalBp);
  const formattedPeriodTotal = new Intl.NumberFormat(locale).format(
    periodTotal,
  );
  const formattedBpToNext = new Intl.NumberFormat(locale).format(
    currentBelt.bpToNextLevel,
  );
  const colorName = await getBeltColorLabel(currentBelt.color);
  const periodLabel = formatPeriodLabel(periodStart, periodEnd, period, locale);
  const beltLabel = t("{color} belt", { color: colorName });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm">
          {t("Total Brain Power")}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-5xl tabular-nums tracking-tight">
            {formattedTotalBp}
          </span>
          <span className="text-lg text-muted-foreground">{t("BP")}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <BeltIndicator color={currentBelt.color} label={beltLabel} size="lg" />
        <div className="flex flex-col">
          <span className="font-medium">
            {t("{color} Belt - Level {level}", {
              color: colorName,
              level: String(currentBelt.level),
            })}
          </span>
          {currentBelt.isMaxLevel ? (
            <span className="text-muted-foreground text-sm">
              {t("Max level reached")}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">
              {t("{value} BP to next level", { value: formattedBpToNext })}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm">{periodLabel}</span>
        <div className="flex items-baseline gap-3">
          <span className="font-semibold text-2xl tabular-nums tracking-tight">
            {t("{value} BP earned", { value: formattedPeriodTotal })}
          </span>
          {previousPeriodTotal !== null && (
            <MetricComparison
              current={periodTotal}
              period={period}
              previous={previousPeriodTotal}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function BeltStatsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-28" />
        <div className="flex items-baseline gap-2">
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-5 w-8" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Skeleton className="size-6 rounded-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-baseline gap-3">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
    </div>
  );
}
