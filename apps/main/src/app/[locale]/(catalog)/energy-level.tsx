import {
  FeatureCard,
  FeatureCardBody,
  FeatureCardHeader,
  FeatureCardHeaderContent,
  FeatureCardIcon,
  FeatureCardIndicator,
  FeatureCardLabel,
  FeatureCardLink,
  FeatureCardSubtitle,
  FeatureCardTitle,
} from "@zoonk/ui/components/feature";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted, getLocale } from "next-intl/server";
import { ClientLink } from "@/i18n/client-link";
import { getMenu } from "@/lib/menu";

export async function EnergyLevel({ energy }: { energy: number }) {
  const t = await getExtracted();
  const locale = await getLocale();
  const energyMenu = getMenu("energy");

  const formattedEnergy = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    trailingZeroDisplay: "stripIfInteger",
  }).format(energy);

  const description =
    energy < 100
      ? t("Keep learning to increase it")
      : t("Keep learning to maintain it");

  return (
    <FeatureCardLink render={<ClientLink href={energyMenu.url} />}>
      <FeatureCard>
        <FeatureCardHeader className="text-energy">
          <FeatureCardHeaderContent>
            <FeatureCardIcon>
              <energyMenu.icon />
            </FeatureCardIcon>
            <FeatureCardLabel>{t("Energy level")}</FeatureCardLabel>
          </FeatureCardHeaderContent>
          <FeatureCardIndicator />
        </FeatureCardHeader>

        <FeatureCardBody>
          <FeatureCardTitle>
            {t("Your energy level is {value}%", { value: formattedEnergy })}
          </FeatureCardTitle>
          <FeatureCardSubtitle>{description}</FeatureCardSubtitle>
        </FeatureCardBody>
      </FeatureCard>
    </FeatureCardLink>
  );
}

export function EnergyLevelSkeleton() {
  return (
    <FeatureCard className="w-full">
      <Skeleton className="h-5 w-28" />

      <FeatureCardBody className="gap-1">
        <Skeleton className="h-4 w-full max-w-40" />
        <Skeleton className="h-3 w-full max-w-28" />
      </FeatureCardBody>
    </FeatureCard>
  );
}
