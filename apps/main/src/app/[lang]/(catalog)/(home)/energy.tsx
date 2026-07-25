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

const HOME_ENERGY_LABEL_ID = "home-energy-label";

/** Gives the home page one direct Energy goal and links to the full history. */
export async function Energy({ energy }: { energy: number }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const energyMenu = getMenu("energy");
  const formattedEnergy = formatMetricPercent({ format, value: energy });

  const description = energy < 100 ? t("Reach 100%") : t("Stay at 100%");

  return (
    <FeatureCardLink render={<Link href={energyMenu.url} prefetch />}>
      <ProgressMetricCard aria-labelledby={HOME_ENERGY_LABEL_ID} className="text-energy">
        <ProgressMetricCardIcon>
          <energyMenu.icon />
        </ProgressMetricCardIcon>
        <ProgressMetricCardLabel id={HOME_ENERGY_LABEL_ID}>{t("Energy")}</ProgressMetricCardLabel>
        <ProgressMetricCardTrailing>
          <FeatureCardIndicator />
        </ProgressMetricCardTrailing>
        <ProgressMetricCardValue>{formattedEnergy}</ProgressMetricCardValue>
        <ProgressMetricCardSubtitle>{description}</ProgressMetricCardSubtitle>
      </ProgressMetricCard>
    </FeatureCardLink>
  );
}

/** Keeps the Energy card stable while the signed-in learner's progress streams. */
export function EnergySkeleton() {
  return (
    <ProgressMetricCard aria-hidden="true" className="w-full">
      <ProgressMetricCardLabelSkeleton className="w-28" />
      <ProgressMetricCardValueSkeleton className="max-w-40" />
      <ProgressMetricCardSubtitleSkeleton className="max-w-28" />
    </ProgressMetricCard>
  );
}
