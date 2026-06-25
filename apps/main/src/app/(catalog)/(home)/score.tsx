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
import { formatMetricPercent } from "@zoonk/utils/number";
import { getExtracted, getFormatter } from "next-intl/server";
import Link from "next/link";

export async function Score({ score }: { score: number }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const scoreMenu = getMenu("score");
  const formattedScore = formatMetricPercent({ format, value: score });

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
            {t("{percentage} correct answers", { percentage: formattedScore })}
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
