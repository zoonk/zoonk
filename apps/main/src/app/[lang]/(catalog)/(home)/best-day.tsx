import {
  ProgressMetricCard,
  ProgressMetricCardIcon,
  ProgressMetricCardLabel,
  ProgressMetricCardLabelSkeleton,
  ProgressMetricCardSubtitle,
  ProgressMetricCardSubtitleSkeleton,
  ProgressMetricCardTrailing,
  ProgressMetricCardValue,
  ProgressMetricCardValueSkeleton,
} from "@/components/progress/progress-metric-card";
import { Link } from "@/i18n/navigation";
import { FeatureCardIndicator, FeatureCardLink } from "@zoonk/ui/components/feature";
import { EPOCH_YEAR, FIRST_SUNDAY_OFFSET } from "@zoonk/utils/date";
import { formatMetricPercent } from "@zoonk/utils/number";
import { CalendarDays } from "lucide-react";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";

export async function BestDay({ score, dayOfWeek }: { score: number; dayOfWeek: number }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const locale = await getLocale();

  const referenceDate = new Date(EPOCH_YEAR, 0, FIRST_SUNDAY_OFFSET + dayOfWeek);

  const dayName = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(referenceDate);

  const formattedScore = formatMetricPercent({ format, value: score });

  return (
    <FeatureCardLink render={<Link href="/score" prefetch />}>
      <ProgressMetricCard className="text-score">
        <ProgressMetricCardIcon>
          <CalendarDays />
        </ProgressMetricCardIcon>
        <ProgressMetricCardLabel>{t("Best day")}</ProgressMetricCardLabel>
        <ProgressMetricCardTrailing>
          <FeatureCardIndicator />
        </ProgressMetricCardTrailing>
        <ProgressMetricCardValue className="first-letter:uppercase">
          {t("{day} with {percentage}", { day: dayName, percentage: formattedScore })}
        </ProgressMetricCardValue>
        <ProgressMetricCardSubtitle>{t("Past 3 months")}</ProgressMetricCardSubtitle>
      </ProgressMetricCard>
    </FeatureCardLink>
  );
}

export function BestDaySkeleton() {
  return (
    <ProgressMetricCard aria-hidden="true" className="w-full">
      <ProgressMetricCardLabelSkeleton className="w-24" />
      <ProgressMetricCardValueSkeleton className="max-w-40" />
      <ProgressMetricCardSubtitleSkeleton className="max-w-28" />
    </ProgressMetricCard>
  );
}
