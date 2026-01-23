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
import { EPOCH_YEAR, FIRST_SUNDAY_OFFSET } from "@zoonk/utils/constants";
import { CalendarDays } from "lucide-react";
import { getExtracted, getLocale } from "next-intl/server";

type BestDayProps = {
  score: number;
  dayOfWeek: number;
};

export async function BestDay({ score, dayOfWeek }: BestDayProps) {
  const t = await getExtracted();
  const locale = await getLocale();

  const referenceDate = new Date(EPOCH_YEAR, 0, FIRST_SUNDAY_OFFSET + dayOfWeek);

  const dayName = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(referenceDate);

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
              <CalendarDays />
            </FeatureCardIcon>
            <FeatureCardLabel>{t("Best day")}</FeatureCardLabel>
          </FeatureCardHeaderContent>
          <FeatureCardIndicator />
        </FeatureCardHeader>

        <FeatureCardBody>
          <FeatureCardTitle className="first-letter:uppercase">
            {t("{day} with {value}%", {
              day: dayName,
              value: formattedScore,
            })}
          </FeatureCardTitle>
          <FeatureCardSubtitle>{t("Past 3 months")}</FeatureCardSubtitle>
        </FeatureCardBody>
      </FeatureCard>
    </FeatureCardLink>
  );
}

export function BestDaySkeleton() {
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
