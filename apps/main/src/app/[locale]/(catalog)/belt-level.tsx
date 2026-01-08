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
import type { BeltColor } from "@zoonk/utils/belt-level";
import { AwardIcon } from "lucide-react";
import { getExtracted, getLocale } from "next-intl/server";

type BeltLevelProps = {
  bpToNextLevel: number;
  color: BeltColor;
  isMaxLevel: boolean;
  level: number;
};

export async function BeltLevel({
  bpToNextLevel,
  color,
  isMaxLevel,
  level,
}: BeltLevelProps) {
  const t = await getExtracted();
  const locale = await getLocale();

  let colorName: string;
  // biome-ignore lint/nursery/noUnnecessaryConditions: exhaustive switch for i18n extraction
  switch (color) {
    case "white":
      colorName = t("White");
      break;
    case "yellow":
      colorName = t("Yellow");
      break;
    case "orange":
      colorName = t("Orange");
      break;
    case "green":
      colorName = t("Green");
      break;
    case "blue":
      colorName = t("Blue");
      break;
    case "purple":
      colorName = t("Purple");
      break;
    case "brown":
      colorName = t("Brown");
      break;
    case "red":
      colorName = t("Red");
      break;
    case "gray":
      colorName = t("Gray");
      break;
    case "black":
      colorName = t("Black");
      break;
  }

  const formattedBp = new Intl.NumberFormat(locale).format(bpToNextLevel);

  const subtitle = isMaxLevel
    ? t("Max level reached")
    : t("{value} BP to next level", { value: formattedBp });

  return (
    <FeatureCard className="w-full">
      <FeatureCardHeader className="text-belt">
        <FeatureCardHeaderContent>
          <FeatureCardIcon>
            <AwardIcon />
          </FeatureCardIcon>
          <FeatureCardLabel>{t("Belt level")}</FeatureCardLabel>
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
  );
}

export function BeltLevelSkeleton() {
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
