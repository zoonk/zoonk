import { getProgressDayCountLabel } from "@/components/progress/progress-day-count-label";
import { getEnergyInsights } from "@/data/progress/get-energy-insights";
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
import { CalendarDays, ZapIcon } from "lucide-react";
import { getExtracted, getLocale } from "next-intl/server";
import { getProgressInsightDateLabel } from "../_components/progress-insight-date-label";
import { getProgressInsightPeriodLabel } from "../_components/progress-insight-period-label";

/**
 * Energy insights mirror the score-page card pattern while answering energy
 * questions that are more useful than another chart value.
 */
export async function EnergyInsights({
  period,
  periodEnd,
  periodStart,
}: {
  period: HistoryPeriod;
  periodEnd: Date;
  periodStart: Date;
}) {
  const locale = await getLocale();
  const insights = await getEnergyInsights({ endDate: periodEnd, startDate: periodStart });

  if (!insights) {
    return null;
  }

  const periodLabel = await getProgressInsightPeriodLabel({ period });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <HighestEnergyDayCard
        date={insights.highestEnergyDay.date}
        energy={insights.highestEnergyDay.energy}
        locale={locale}
        periodLabel={periodLabel}
      />

      <FullEnergyCard count={insights.fullEnergyDays} periodLabel={periodLabel} />
    </div>
  );
}

/**
 * The highest-energy card highlights the exact calendar day, with ties resolved
 * by the data helper so the UI only formats the winning row.
 */
async function HighestEnergyDayCard({
  date,
  energy,
  locale,
  periodLabel,
}: {
  date: Date;
  energy: number;
  locale: string;
  periodLabel: string;
}) {
  const t = await getExtracted();

  const formattedDate = getProgressInsightDateLabel({ date, locale });

  const formattedEnergy = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    trailingZeroDisplay: "stripIfInteger",
  }).format(energy);

  return (
    <FeatureCard aria-labelledby="energy-highest-day-label">
      <FeatureCardHeader className="text-energy">
        <FeatureCardHeaderContent>
          <FeatureCardIcon>
            <CalendarDays />
          </FeatureCardIcon>
          <FeatureCardLabel id="energy-highest-day-label">
            {t("Highest energy day")}
          </FeatureCardLabel>
        </FeatureCardHeaderContent>
      </FeatureCardHeader>

      <FeatureCardBody>
        <FeatureCardTitle>
          {t("{day} with {value}%", { day: formattedDate, value: formattedEnergy })}
        </FeatureCardTitle>
        <FeatureCardSubtitle>{periodLabel}</FeatureCardSubtitle>
      </FeatureCardBody>
    </FeatureCard>
  );
}

/**
 * Full-energy days are useful even at zero because they tell the learner how
 * often they kept Energy capped during the selected window.
 */
async function FullEnergyCard({ count, periodLabel }: { count: number; periodLabel: string }) {
  const t = await getExtracted();
  const countLabel = await getProgressDayCountLabel({ count });

  return (
    <FeatureCard aria-labelledby="energy-full-energy-label">
      <FeatureCardHeader className="text-energy">
        <FeatureCardHeaderContent>
          <FeatureCardIcon>
            <ZapIcon />
          </FeatureCardIcon>
          <FeatureCardLabel id="energy-full-energy-label">{t("Full energy")}</FeatureCardLabel>
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
 * Keep the loading layout the same size as the loaded insight cards so the
 * progress page does not jump when server data resolves.
 */
export function EnergyInsightsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FeatureCard className="w-full">
        <Skeleton className="h-5 w-36" />
        <FeatureCardBody className="gap-1">
          <Skeleton className="h-4 w-full max-w-44" />
          <Skeleton className="h-3 w-full max-w-28" />
        </FeatureCardBody>
      </FeatureCard>

      <FeatureCard className="w-full">
        <Skeleton className="h-5 w-24" />
        <FeatureCardBody className="gap-1">
          <Skeleton className="h-4 w-full max-w-28" />
          <Skeleton className="h-3 w-full max-w-28" />
        </FeatureCardBody>
      </FeatureCard>
    </div>
  );
}
