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
import { formatMetricPercent } from "@zoonk/utils/number";
import { Clock } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";

export async function BestTime({ score, period }: { score: number; period: number }) {
  const t = await getExtracted();
  const format = await getFormatter();

  const periodNames = [t("Night"), t("Morning"), t("Afternoon"), t("Evening")] as const;

  const periodName = periodNames[period] ?? periodNames[1];

  const formattedScore = formatMetricPercent({ format, value: score });

  return (
    <FeatureCardLink render={<Link href="/score" prefetch />}>
      <ProgressMetricCard className="text-score">
        <ProgressMetricCardIcon>
          <Clock />
        </ProgressMetricCardIcon>
        <ProgressMetricCardLabel>{t("Best time")}</ProgressMetricCardLabel>
        <ProgressMetricCardTrailing>
          <FeatureCardIndicator />
        </ProgressMetricCardTrailing>
        <ProgressMetricCardValue className="first-letter:uppercase">
          {t("{period} with {percentage}", { percentage: formattedScore, period: periodName })}
        </ProgressMetricCardValue>
        <ProgressMetricCardSubtitle>{t("Past 3 months")}</ProgressMetricCardSubtitle>
      </ProgressMetricCard>
    </FeatureCardLink>
  );
}

export function BestTimeSkeleton() {
  return (
    <ProgressMetricCard aria-hidden="true" className="w-full">
      <ProgressMetricCardLabelSkeleton className="w-24" />
      <ProgressMetricCardValueSkeleton className="max-w-40" />
      <ProgressMetricCardSubtitleSkeleton className="max-w-28" />
    </ProgressMetricCard>
  );
}
