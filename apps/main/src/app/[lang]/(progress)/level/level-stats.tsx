import { getBeltLabel } from "@/lib/belt-colors";
import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type BeltLevelResult } from "@zoonk/utils/belt-level";
import { type HistoryPeriod, formatPeriodLabel } from "@zoonk/utils/date-ranges";
import { formatWholeNumber } from "@zoonk/utils/number";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";
import { MetricComparison } from "../_components/metric-comparison";
import {
  ProgressHeadline,
  ProgressHeadlineLabel,
  ProgressHeadlineRow,
  ProgressHeadlineValue,
} from "../_components/progress-headline";

export async function LevelStats({
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
  const format = await getFormatter();
  const locale = await getLocale();

  const formattedTotalBp = formatWholeNumber({ format, value: totalBp });
  const formattedPeriodTotal = formatWholeNumber({ format, value: periodTotal });
  const formattedBpToNext = formatWholeNumber({ format, value: currentBelt.bpToNextLevel });
  const beltLabel = await getBeltLabel({ color: currentBelt.color });
  const periodLabel = formatPeriodLabel(periodStart, periodEnd, period, locale);

  return (
    <div className="flex flex-col gap-6">
      <ProgressHeadline>
        <ProgressHeadlineLabel>{t("Total Brain Power")}</ProgressHeadlineLabel>
        <ProgressHeadlineRow className="gap-2">
          <ProgressHeadlineValue>{formattedTotalBp}</ProgressHeadlineValue>
          <span className="text-muted-foreground text-lg">{t("BP")}</span>
        </ProgressHeadlineRow>
      </ProgressHeadline>

      <div className="flex items-center gap-3">
        <BeltIndicator color={currentBelt.color} label={beltLabel} size="lg" />
        <div className="flex flex-col">
          <span className="font-medium">
            {t("{belt} - Level {level}", { belt: beltLabel, level: String(currentBelt.level) })}
          </span>
          {currentBelt.isMaxLevel ? (
            <span className="text-muted-foreground text-sm">{t("Max level reached")}</span>
          ) : (
            <span className="text-muted-foreground text-sm">
              {t("{value} BP to next level", { value: formattedBpToNext })}
            </span>
          )}
        </div>
      </div>

      <ProgressHeadline>
        <ProgressHeadlineLabel>{periodLabel}</ProgressHeadlineLabel>
        <ProgressHeadlineRow>
          <ProgressHeadlineValue className="text-2xl font-semibold">
            {t("{value} BP earned", { value: formattedPeriodTotal })}
          </ProgressHeadlineValue>
          {previousPeriodTotal !== null && (
            <MetricComparison
              current={periodTotal}
              period={period}
              previous={previousPeriodTotal}
            />
          )}
        </ProgressHeadlineRow>
      </ProgressHeadline>
    </div>
  );
}

export function LevelStatsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <ProgressHeadline>
        <Skeleton className="h-4 w-28" />
        <ProgressHeadlineRow className="gap-2">
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-5 w-8" />
        </ProgressHeadlineRow>
      </ProgressHeadline>

      <div className="flex items-center gap-3">
        <Skeleton className="size-6 rounded-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      <ProgressHeadline>
        <Skeleton className="h-4 w-24" />
        <ProgressHeadlineRow>
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-5 w-32" />
        </ProgressHeadlineRow>
      </ProgressHeadline>
    </div>
  );
}
