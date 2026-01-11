import {
  FeatureCard,
  FeatureCardBody,
  FeatureCardHeader,
  FeatureCardHeaderContent,
  FeatureCardIcon,
  FeatureCardLabel,
  FeatureCardSubtitle,
  FeatureCardTitle,
} from "@zoonk/ui/components/feature";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { CalendarDays, Clock } from "lucide-react";
import { getExtracted, getLocale } from "next-intl/server";
import type { HistoryPeriod } from "@/data/progress/_utils";
import { getBestDay } from "@/data/progress/get-best-day";
import { getBestTime } from "@/data/progress/get-best-time";

async function getPeriodLabel(period: HistoryPeriod): Promise<string> {
  const t = await getExtracted();

  if (period === "month") {
    return t("This month");
  }

  if (period === "6months") {
    return t("Past 6 months");
  }

  return t("This year");
}

export async function ScoreInsights({
  period,
  periodStart,
}: {
  period: HistoryPeriod;
  periodStart: Date;
}) {
  const locale = await getLocale();

  const [bestDayData, bestTimeData, periodLabel] = await Promise.all([
    getBestDay({ startDate: periodStart }),
    getBestTime({ startDate: periodStart }),
    getPeriodLabel(period),
  ]);

  if (!(bestDayData || bestTimeData)) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
    </div>
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

  const referenceDate = new Date(1970, 0, 4 + dayOfWeek);

  const dayName = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(
    referenceDate,
  );

  const formattedScore = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    trailingZeroDisplay: "stripIfInteger",
  }).format(score);

  return (
    <FeatureCard>
      <FeatureCardHeader className="text-score">
        <FeatureCardHeaderContent>
          <FeatureCardIcon>
            <CalendarDays />
          </FeatureCardIcon>
          <FeatureCardLabel>{t("Best day")}</FeatureCardLabel>
        </FeatureCardHeaderContent>
      </FeatureCardHeader>

      <FeatureCardBody>
        <FeatureCardTitle className="first-letter:uppercase">
          {t("{day} with {value}%", {
            day: dayName,
            value: formattedScore,
          })}
        </FeatureCardTitle>
        <FeatureCardSubtitle>{periodLabel}</FeatureCardSubtitle>
      </FeatureCardBody>
    </FeatureCard>
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
  const locale = await getLocale();

  const periodNames = [
    t("Night"),
    t("Morning"),
    t("Afternoon"),
    t("Evening"),
  ] as const;

  const periodName = periodNames[period] ?? periodNames[1];

  const formattedScore = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    trailingZeroDisplay: "stripIfInteger",
  }).format(score);

  return (
    <FeatureCard>
      <FeatureCardHeader className="text-score">
        <FeatureCardHeaderContent>
          <FeatureCardIcon>
            <Clock />
          </FeatureCardIcon>
          <FeatureCardLabel>{t("Best time")}</FeatureCardLabel>
        </FeatureCardHeaderContent>
      </FeatureCardHeader>

      <FeatureCardBody>
        <FeatureCardTitle className="first-letter:uppercase">
          {t("{period} with {value}%", {
            period: periodName,
            value: formattedScore,
          })}
        </FeatureCardTitle>
        <FeatureCardSubtitle>{periodLabel}</FeatureCardSubtitle>
      </FeatureCardBody>
    </FeatureCard>
  );
}

export function ScoreInsightsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FeatureCard className="w-full">
        <Skeleton className="h-5 w-24" />
        <FeatureCardBody className="gap-1">
          <Skeleton className="h-4 w-full max-w-40" />
          <Skeleton className="h-3 w-full max-w-28" />
        </FeatureCardBody>
      </FeatureCard>

      <FeatureCard className="w-full">
        <Skeleton className="h-5 w-24" />
        <FeatureCardBody className="gap-1">
          <Skeleton className="h-4 w-full max-w-40" />
          <Skeleton className="h-3 w-full max-w-28" />
        </FeatureCardBody>
      </FeatureCard>
    </div>
  );
}
