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

export async function Energy({ energy }: { energy: number }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const energyMenu = getMenu("energy");
  const formattedEnergy = formatMetricPercent({ format, value: energy });

  const description =
    energy < 100 ? t("Keep learning to increase it") : t("Keep learning to maintain it");

  return (
    <FeatureCardLink render={<Link href={energyMenu.url} prefetch />}>
      <ProgressMetricCard aria-labelledby="home-energy-label" className="text-energy">
        <ProgressMetricCardIcon>
          <energyMenu.icon />
        </ProgressMetricCardIcon>
        <ProgressMetricCardLabel id="home-energy-label">{t("Energy")}</ProgressMetricCardLabel>
        <ProgressMetricCardTrailing>
          <FeatureCardIndicator />
        </ProgressMetricCardTrailing>
        <ProgressMetricCardValue>
          {t("Your energy is {percentage}", { percentage: formattedEnergy })}
        </ProgressMetricCardValue>
        <ProgressMetricCardSubtitle>{description}</ProgressMetricCardSubtitle>
      </ProgressMetricCard>
    </FeatureCardLink>
  );
}

export function EnergySkeleton() {
  return (
    <ProgressMetricCard aria-hidden="true" className="w-full">
      <ProgressMetricCardLabelSkeleton className="w-28" />
      <ProgressMetricCardValueSkeleton className="max-w-40" />
      <ProgressMetricCardSubtitleSkeleton className="max-w-28" />
    </ProgressMetricCard>
  );
}
