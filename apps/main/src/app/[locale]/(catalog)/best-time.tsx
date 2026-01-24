import { ClientLink } from "@/i18n/client-link";
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
import { Clock } from "lucide-react";
import { getExtracted, getLocale } from "next-intl/server";

export async function BestTime({ score, period }: { score: number; period: number }) {
  const t = await getExtracted();
  const locale = await getLocale();

  const periodNames = [t("Night"), t("Morning"), t("Afternoon"), t("Evening")] as const;

  const periodName = periodNames[period] ?? periodNames[1];

  const formattedScore = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    trailingZeroDisplay: "stripIfInteger",
  }).format(score);

  return (
    <FeatureCardLink render={<ClientLink href="/score" />}>
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
            {t("{period} with {value}%", {
              period: periodName,
              value: formattedScore,
            })}
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
