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
import { getMenu } from "@/lib/menu";
import { FeatureCardIndicator, FeatureCardLink } from "@zoonk/ui/components/feature";
import { formatMetricPercent } from "@zoonk/utils/number";
import { getExtracted, getFormatter } from "next-intl/server";

export async function Score({ score }: { score: number }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const scoreMenu = getMenu("score");
  const formattedScore = formatMetricPercent({ format, value: score });

  return (
    <FeatureCardLink render={<Link href={scoreMenu.url} prefetch />}>
      <ProgressMetricCard className="text-score">
        <ProgressMetricCardIcon>
          <scoreMenu.icon />
        </ProgressMetricCardIcon>
        <ProgressMetricCardLabel>{t("Score")}</ProgressMetricCardLabel>
        <ProgressMetricCardTrailing>
          <FeatureCardIndicator />
        </ProgressMetricCardTrailing>
        <ProgressMetricCardValue>
          {t("{percentage} correct answers", { percentage: formattedScore })}
        </ProgressMetricCardValue>
        <ProgressMetricCardSubtitle>{t("Past 3 months")}</ProgressMetricCardSubtitle>
      </ProgressMetricCard>
    </FeatureCardLink>
  );
}

export function ScoreSkeleton() {
  return (
    <ProgressMetricCard aria-hidden="true" className="w-full">
      <ProgressMetricCardLabelSkeleton className="w-24" />
      <ProgressMetricCardValueSkeleton className="max-w-40" />
      <ProgressMetricCardSubtitleSkeleton className="max-w-28" />
    </ProgressMetricCard>
  );
}
