import { getProgressDayCountLabel } from "@/components/progress/progress-day-count-label";
import {
  TotalLearningTimeCard,
  TotalLearningTimeCardSkeleton,
} from "@/components/progress/total-learning-time-card";
import { getLevelInsights } from "@/data/progress/get-level-insights";
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
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";
import { formatWholeNumber } from "@zoonk/utils/number";
import { BrainIcon, CalendarDays } from "lucide-react";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";
import { getProgressInsightDateLabel } from "../_components/progress-insight-date-label";
import { getProgressInsightPeriodLabel } from "../_components/progress-insight-period-label";

/**
 * Level insights add calendar context to Brain Power: the best learning day,
 * how often the learner completed lessons, and how much lesson time they logged
 * in the selected window.
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {insights.highestBpDay && (
        <HighestBpCard
          brainPower={insights.highestBpDay.brainPower}
          date={insights.highestBpDay.date}
          locale={locale}
          periodLabel={periodLabel}
        />
      )}

      <LearningDaysCard count={insights.learningDays} periodLabel={periodLabel} />

      <TotalLearningTimeCard
        labelId="level-total-learning-time-label"
        subtitle={periodLabel}
        totalLearningSeconds={insights.totalLearningSeconds}
      />
    </div>
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
    <FeatureCard aria-labelledby="level-highest-bp-label">
      <FeatureCardHeader>
        <FeatureCardHeaderContent>
          <FeatureCardIcon>
            <BrainIcon />
          </FeatureCardIcon>
          <FeatureCardLabel id="level-highest-bp-label">{t("Highest BP")}</FeatureCardLabel>
        </FeatureCardHeaderContent>
      </FeatureCardHeader>

      <FeatureCardBody>
        <FeatureCardTitle>
          {t("{date} with {value} BP", { date: formattedDate, value: formattedBrainPower })}
        </FeatureCardTitle>
        <FeatureCardSubtitle>{periodLabel}</FeatureCardSubtitle>
      </FeatureCardBody>
    </FeatureCard>
  );
}

/**
 * Learning days counts completed-lesson calendar days, not raw attempts, so it
 * stays focused on meaningful learning sessions.
 */
async function LearningDaysCard({ count, periodLabel }: { count: number; periodLabel: string }) {
  const t = await getExtracted();
  const countLabel = await getProgressDayCountLabel({ count });

  return (
    <FeatureCard aria-labelledby="level-learning-days-label">
      <FeatureCardHeader>
        <FeatureCardHeaderContent>
          <FeatureCardIcon>
            <CalendarDays />
          </FeatureCardIcon>
          <FeatureCardLabel id="level-learning-days-label">{t("Learning days")}</FeatureCardLabel>
        </FeatureCardHeaderContent>
      </FeatureCardHeader>

      <FeatureCardBody>
        <FeatureCardTitle>{countLabel}</FeatureCardTitle>
        <FeatureCardSubtitle>{periodLabel}</FeatureCardSubtitle>
      </FeatureCardBody>
    </FeatureCard>
  );
}

/**
 * Keep the Level page skeleton aligned with the loaded insight cards.
 */
export function LevelInsightsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FeatureCard className="w-full">
        <Skeleton className="h-5 w-24" />
        <FeatureCardBody className="gap-1">
          <Skeleton className="h-4 w-full max-w-44" />
          <Skeleton className="h-3 w-full max-w-28" />
        </FeatureCardBody>
      </FeatureCard>

      <FeatureCard className="w-full">
        <Skeleton className="h-5 w-28" />
        <FeatureCardBody className="gap-1">
          <Skeleton className="h-4 w-full max-w-28" />
          <Skeleton className="h-3 w-full max-w-28" />
        </FeatureCardBody>
      </FeatureCard>

      <TotalLearningTimeCardSkeleton />
    </div>
  );
}
