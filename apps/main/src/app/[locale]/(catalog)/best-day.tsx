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
import { CalendarDays } from "lucide-react";
import { getExtracted, getLocale } from "next-intl/server";
import { ClientLink } from "@/i18n/client-link";

type BestDayProps = {
  accuracy: number;
  dayOfWeek: number;
};

export async function BestDay({ accuracy, dayOfWeek }: BestDayProps) {
  const t = await getExtracted();
  const locale = await getLocale();

  const referenceDate = new Date(1970, 0, 4 + dayOfWeek);

  const dayName = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(
    referenceDate,
  );

  const formattedAccuracy = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    trailingZeroDisplay: "stripIfInteger",
  }).format(accuracy);

  return (
    <FeatureCardLink render={<ClientLink href="/score" />}>
      <FeatureCard>
        <FeatureCardHeader className="text-accuracy">
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
              value: formattedAccuracy,
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
