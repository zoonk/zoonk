import {
  FeatureCard,
  FeatureCardBody,
  FeatureCardHeader,
  FeatureCardHeaderContent,
  FeatureCardIcon,
  FeatureCardIndicator,
  FeatureCardLabel,
  FeatureCardSubtitle,
  FeatureCardTitle,
} from "@zoonk/ui/components/feature";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ZapIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

export async function EnergyLevel({ energy }: { energy: number }) {
  const t = await getExtracted();
  const roundedEnergy = Math.round(energy);

  const description =
    energy < 100
      ? t("Keep learning to increase it")
      : t("Keep learning to maintain it");

  return (
    <FeatureCard className="w-full max-w-xs">
      <FeatureCardHeader className="text-orange-500">
        <FeatureCardHeaderContent>
          <FeatureCardIcon>
            <ZapIcon />
          </FeatureCardIcon>
          <FeatureCardLabel>{t("Energy level")}</FeatureCardLabel>
        </FeatureCardHeaderContent>
        <FeatureCardIndicator />
      </FeatureCardHeader>

      <FeatureCardBody>
        <FeatureCardTitle>
          {t("Your energy level is {value}%", { value: String(roundedEnergy) })}
        </FeatureCardTitle>
        <FeatureCardSubtitle>{description}</FeatureCardSubtitle>
      </FeatureCardBody>
    </FeatureCard>
  );
}

export function EnergyLevelSkeleton() {
  return (
    <FeatureCard className="w-full max-w-xs">
      <Skeleton className="h-5 w-28" />

      <FeatureCardBody className="gap-1">
        <Skeleton className="h-4 w-full max-w-40" />
        <Skeleton className="h-3 w-full max-w-28" />
      </FeatureCardBody>
    </FeatureCard>
  );
}
