import { getMenu } from "@/lib/menu";
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
import Link from "next/link";

export async function Energy({ energy }: { energy: number }) {
  const t = await getExtracted();
  const locale = await getLocale();
  const energyMenu = getMenu("energy");

  const formattedEnergy = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    trailingZeroDisplay: "stripIfInteger",
  }).format(energy);

  const description =
    energy < 100 ? t("Keep learning to increase it") : t("Keep learning to maintain it");

  return (
    <FeatureCardLink render={<Link href={energyMenu.url} prefetch />}>
      <FeatureCard>
        <FeatureCardHeader className="text-energy">
          <FeatureCardHeaderContent>
            <FeatureCardIcon>
              <energyMenu.icon />
            </FeatureCardIcon>
            <FeatureCardLabel>{t("Energy")}</FeatureCardLabel>
          </FeatureCardHeaderContent>
          <FeatureCardIndicator />
        </FeatureCardHeader>

        <FeatureCardBody>
          <FeatureCardTitle>
            {t("Your energy is {value}%", { value: formattedEnergy })}
          </FeatureCardTitle>
          <FeatureCardSubtitle>{description}</FeatureCardSubtitle>
        </FeatureCardBody>
      </FeatureCard>
    </FeatureCardLink>
  );
}

export function EnergySkeleton() {
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
