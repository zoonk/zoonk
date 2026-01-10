import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted, getLocale } from "next-intl/server";
import type { EnergyPeriod } from "@/data/progress/get-energy-history";
import { EnergyComparison } from "./energy-comparison";

type EnergyStatsProps = {
  average: number;
  period: EnergyPeriod;
  periodEnd: Date;
  periodStart: Date;
  previousAverage: number | null;
};

function formatPeriodLabel(
  periodStart: Date,
  periodEnd: Date,
  period: EnergyPeriod,
  locale: string,
): string {
  if (period === "month") {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(periodStart);
  }

  if (period === "6months") {
    const startMonth = new Intl.DateTimeFormat(locale, {
      month: "short",
    }).format(periodStart);
    const endMonth = new Intl.DateTimeFormat(locale, { month: "short" }).format(
      periodEnd,
    );
    const year = periodStart.getFullYear();
    return `${startMonth} - ${endMonth} ${year}`;
  }

  // Year
  return String(periodStart.getFullYear());
}

export async function EnergyStats({
  average,
  period,
  periodEnd,
  periodStart,
  previousAverage,
}: EnergyStatsProps) {
  const t = await getExtracted();
  const locale = await getLocale();

  const formattedAverage = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    trailingZeroDisplay: "stripIfInteger",
  }).format(average);

  const periodLabel = formatPeriodLabel(periodStart, periodEnd, period, locale);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-sm">{periodLabel}</span>

      <div className="flex items-baseline gap-3">
        <span className="font-bold text-5xl text-energy tabular-nums tracking-tight">
          {t("{value}%", { value: formattedAverage })}
        </span>

        {previousAverage !== null && (
          <EnergyComparison
            current={average}
            period={period}
            previous={previousAverage}
          />
        )}
      </div>
    </div>
  );
}

export function EnergyStatsSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      <Skeleton className="h-4 w-28" />
      <div className="flex items-baseline gap-3">
        <Skeleton className="h-12 w-28" />
        <Skeleton className="h-5 w-32" />
      </div>
    </div>
  );
}
