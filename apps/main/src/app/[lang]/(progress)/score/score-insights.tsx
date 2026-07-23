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
import { getBestDay } from "@/data/progress/get-best-day";
import { getBestTime } from "@/data/progress/get-best-time";
import { EPOCH_YEAR, FIRST_SUNDAY_OFFSET } from "@zoonk/utils/date";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";
import { formatMetricPercent } from "@zoonk/utils/number";
import { CalendarDays, Clock } from "lucide-react";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";
import { ProgressInsightGrid } from "../_components/progress-insight-grid";
import { getProgressInsightPeriodLabel } from "../_components/progress-insight-period-label";

export async function ScoreInsights({
  period,
  periodEnd,
  periodStart,
}: {
  period: HistoryPeriod;
  periodEnd: Date;
  periodStart: Date;
}) {
  const locale = await getLocale();

  const [bestDayData, bestTimeData] = await Promise.all([
    getBestDay({ endDate: periodEnd, startDate: periodStart }),
    getBestTime({ endDate: periodEnd, startDate: periodStart }),
  ]);

  if (!(bestDayData || bestTimeData)) {
    return null;
  }

  const periodLabel = await getProgressInsightPeriodLabel({ period });

  return (
    <ProgressInsightGrid>
      {bestDayData && (
        <BestDayCard
          dayOfWeek={bestDayData.dayOfWeek}
          locale={locale}
          periodLabel={periodLabel}
          score={bestDayData.score}
        />
      )}

      {bestTimeData && (
        <BestTimeCard
          period={bestTimeData.period}
          periodLabel={periodLabel}
          score={bestTimeData.score}
        />
      )}
    </ProgressInsightGrid>
  );
}

async function BestDayCard({
  score,
  dayOfWeek,
  locale,
  periodLabel,
}: {
  score: number;
  dayOfWeek: number;
  locale: string;
  periodLabel: string;
}) {
  const t = await getExtracted();
  const format = await getFormatter();

  const referenceDate = new Date(EPOCH_YEAR, 0, FIRST_SUNDAY_OFFSET + dayOfWeek);

  const dayName = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(referenceDate);
  const formattedScore = formatMetricPercent({ format, value: score });

  return (
    <ProgressMetricCard className="text-score">
      <ProgressMetricCardIcon>
        <CalendarDays />
      </ProgressMetricCardIcon>
      <ProgressMetricCardLabel>{t("Best day")}</ProgressMetricCardLabel>
      <ProgressMetricCardValue className="first-letter:uppercase">
        {t("{day} with {percentage}", { day: dayName, percentage: formattedScore })}
      </ProgressMetricCardValue>
      <ProgressMetricCardSubtitle>{periodLabel}</ProgressMetricCardSubtitle>
    </ProgressMetricCard>
  );
}

async function BestTimeCard({
  score,
  period,
  periodLabel,
}: {
  score: number;
  period: number;
  periodLabel: string;
}) {
  const t = await getExtracted();
  const format = await getFormatter();

  const periodNames = [t("Night"), t("Morning"), t("Afternoon"), t("Evening")] as const;

  const periodName = periodNames[period] ?? periodNames[1];

  const formattedScore = formatMetricPercent({ format, value: score });

  return (
    <ProgressMetricCard className="text-score">
      <ProgressMetricCardIcon>
        <Clock />
      </ProgressMetricCardIcon>
      <ProgressMetricCardLabel>{t("Best time")}</ProgressMetricCardLabel>
      <ProgressMetricCardValue className="first-letter:uppercase">
        {t("{period} with {percentage}", { percentage: formattedScore, period: periodName })}
      </ProgressMetricCardValue>
      <ProgressMetricCardSubtitle>{periodLabel}</ProgressMetricCardSubtitle>
    </ProgressMetricCard>
  );
}

export function ScoreInsightsSkeleton() {
  return (
    <ProgressInsightGrid>
      <ProgressMetricCard aria-hidden="true" className="w-full">
        <ProgressMetricCardLabelSkeleton className="w-24" />
        <ProgressMetricCardValueSkeleton className="max-w-40" />
        <ProgressMetricCardSubtitleSkeleton className="max-w-28" />
      </ProgressMetricCard>

      <ProgressMetricCard aria-hidden="true" className="w-full">
        <ProgressMetricCardLabelSkeleton className="w-24" />
        <ProgressMetricCardValueSkeleton className="max-w-40" />
        <ProgressMetricCardSubtitleSkeleton className="max-w-28" />
      </ProgressMetricCard>
    </ProgressInsightGrid>
  );
}
