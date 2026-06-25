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
import { Clock } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import Link from "next/link";

export async function BestTime({ score, period }: { score: number; period: number }) {
  const t = await getExtracted();
  const format = await getFormatter();

  const periodNames = [t("Night"), t("Morning"), t("Afternoon"), t("Evening")] as const;

  const periodName = periodNames[period] ?? periodNames[1];

  const formattedScore = formatMetricPercent({ format, value: score });

  return (
    <FeatureCardLink render={<Link href="/score" prefetch />}>
      <FeatureCard>
        <FeatureCardHeader className="text-score">
          <FeatureCardHeaderContent>
            <FeatureCardIcon>
              <Clock />
            </FeatureCardIcon>
            <FeatureCardLabel>{t("Best time")}</FeatureCardLabel>
          </FeatureCardHeaderContent>
          <FeatureCardIndicator />
        </FeatureCardHeader>

        <FeatureCardBody>
          <FeatureCardTitle className="first-letter:uppercase">
            {t("{period} with {percentage}", { percentage: formattedScore, period: periodName })}
          </FeatureCardTitle>
          <FeatureCardSubtitle>{t("Past 3 months")}</FeatureCardSubtitle>
        </FeatureCardBody>
      </FeatureCard>
    </FeatureCardLink>
  );
}

export function BestTimeSkeleton() {
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
