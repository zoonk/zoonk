import { ClientLink } from "@/i18n/client-link";
import { getBeltColorLabel } from "@/lib/belt-colors";
import { getMenu } from "@/lib/menu";
import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import {
  FeatureCard,
  FeatureCardBody,
  FeatureCardHeader,
  FeatureCardHeaderContent,
  FeatureCardIndicator,
  FeatureCardLabel,
  FeatureCardLink,
  FeatureCardSubtitle,
  FeatureCardTitle,
} from "@zoonk/ui/components/feature";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted, getLocale } from "next-intl/server";
import type { BeltColor } from "@zoonk/utils/belt-level";

type LevelProps = {
  bpToNextLevel: number;
  color: BeltColor;
  isMaxLevel: boolean;
  level: number;
};

export async function Level({ bpToNextLevel, color, isMaxLevel, level }: LevelProps) {
  const t = await getExtracted();
  const locale = await getLocale();
  const levelMenu = getMenu("level");

  const colorName = await getBeltColorLabel(color);

  const formattedBp = new Intl.NumberFormat(locale).format(bpToNextLevel);

  const subtitle = isMaxLevel
    ? t("Max level reached")
    : t("{value} BP to next level", { value: formattedBp });

  const beltLabel = t("{color} belt", { color: colorName });

  return (
    <FeatureCardLink render={<ClientLink href={levelMenu.url} />}>
      <FeatureCard>
        <FeatureCardHeader>
          <FeatureCardHeaderContent>
            <BeltIndicator color={color} label={beltLabel} size="sm" />
            <FeatureCardLabel>{t("Level")}</FeatureCardLabel>
          </FeatureCardHeaderContent>
          <FeatureCardIndicator />
        </FeatureCardHeader>

        <FeatureCardBody>
          <FeatureCardTitle>
            {t("{color} Belt - Level {level}", {
              color: colorName,
              level: String(level),
            })}
          </FeatureCardTitle>
          <FeatureCardSubtitle>{subtitle}</FeatureCardSubtitle>
        </FeatureCardBody>
      </FeatureCard>
    </FeatureCardLink>
  );
}

export function LevelSkeleton() {
  return (
    <FeatureCard className="w-full">
      <Skeleton className="h-5 w-24" />

      <FeatureCardBody className="gap-1">
        <Skeleton className="h-4 w-full max-w-40" />
        <Skeleton className="h-3 w-full max-w-28" />
      </FeatureCardBody>
    </FeatureCard>
  );
}
