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

export async function Score({ score }: { score: number }) {
  const t = await getExtracted();
  const locale = await getLocale();
  const scoreMenu = getMenu("score");

  const formattedScore = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    trailingZeroDisplay: "stripIfInteger",
  }).format(score);

  return (
    <FeatureCardLink render={<Link href={scoreMenu.url} prefetch />}>
      <FeatureCard>
        <FeatureCardHeader className="text-score">
          <FeatureCardHeaderContent>
            <FeatureCardIcon>
              <scoreMenu.icon />
            </FeatureCardIcon>
            <FeatureCardLabel>{t("Score")}</FeatureCardLabel>
          </FeatureCardHeaderContent>
          <FeatureCardIndicator />
        </FeatureCardHeader>

        <FeatureCardBody>
          <FeatureCardTitle>
            {t("{value}% correct answers", { value: formattedScore })}
          </FeatureCardTitle>
          <FeatureCardSubtitle>{t("Past 3 months")}</FeatureCardSubtitle>
        </FeatureCardBody>
      </FeatureCard>
    </FeatureCardLink>
  );
}

export function ScoreSkeleton() {
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
