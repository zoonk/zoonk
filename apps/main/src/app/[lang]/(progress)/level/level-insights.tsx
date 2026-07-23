import {
  ProgressMetricCard,
  ProgressMetricCardIcon,
  ProgressMetricCardLabel,
  ProgressMetricCardLabelSkeleton,
  ProgressMetricCardSubtitle,
  ProgressMetricCardSubtitleSkeleton,
  ProgressMetricCardValue,
  ProgressMetricCardValueSkeleton,
} from "@/components/progress/progress-metric-card";
import { getLevelInsights } from "@/data/progress/get-level-insights";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";
import { formatWholeNumber } from "@zoonk/utils/number";
import { BrainIcon } from "lucide-react";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";
import { getProgressInsightDateLabel } from "../_components/progress-insight-date-label";
import { getProgressInsightPeriodLabel } from "../_components/progress-insight-period-label";

/**
 * Level keeps the strongest day beside its Brain Power chart, while general
 * learning totals live on Activity.
 */
export async function LevelInsights({
  period,
  periodEnd,
  periodStart,
}: {
  period: HistoryPeriod;
  periodEnd: Date;
  periodStart: Date;
}) {
  const locale = await getLocale();
  const insights = await getLevelInsights({ endDate: periodEnd, startDate: periodStart });

  if (!insights) {
    return null;
  }

  const periodLabel = await getProgressInsightPeriodLabel({ period });

  return (
    <HighestBpCard
      brainPower={insights.highestBpDay.brainPower}
      date={insights.highestBpDay.date}
      locale={locale}
      periodLabel={periodLabel}
    />
  );
}

/**
 * Highest BP points to the single strongest learning day, so the learner can
 * connect Brain Power with a concrete date rather than only an aggregate.
 */
async function HighestBpCard({
  brainPower,
  date,
  locale,
  periodLabel,
}: {
  brainPower: number;
  date: Date;
  locale: string;
  periodLabel: string;
}) {
  const t = await getExtracted();
  const format = await getFormatter();

  const formattedDate = getProgressInsightDateLabel({ date, locale });
  const formattedBrainPower = formatWholeNumber({ format, value: brainPower });

  return (
    <ProgressMetricCard aria-labelledby="level-highest-bp-label">
      <ProgressMetricCardIcon>
        <BrainIcon />
      </ProgressMetricCardIcon>
      <ProgressMetricCardLabel id="level-highest-bp-label">
        {t("Highest BP")}
      </ProgressMetricCardLabel>
      <ProgressMetricCardValue>
        {t("{date} with {value} BP", { date: formattedDate, value: formattedBrainPower })}
      </ProgressMetricCardValue>
      <ProgressMetricCardSubtitle>{periodLabel}</ProgressMetricCardSubtitle>
    </ProgressMetricCard>
  );
}

/** Keeps the Level page stable while its strongest-day insight loads. */
export function LevelInsightsSkeleton() {
  return (
    <ProgressMetricCard aria-hidden="true" className="w-full">
      <ProgressMetricCardLabelSkeleton className="w-24" />
      <ProgressMetricCardValueSkeleton className="max-w-44" />
      <ProgressMetricCardSubtitleSkeleton className="max-w-28" />
    </ProgressMetricCard>
  );
}
