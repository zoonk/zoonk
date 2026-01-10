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
import { TargetIcon } from "lucide-react";
import { getExtracted, getLocale } from "next-intl/server";
import { ClientLink } from "@/i18n/client-link";

export async function Accuracy({ accuracy }: { accuracy: number }) {
  const t = await getExtracted();
  const locale = await getLocale();

  const formattedAccuracy = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    trailingZeroDisplay: "stripIfInteger",
  }).format(accuracy);

  return (
    <FeatureCardLink render={<ClientLink href="/accuracy" />}>
      <FeatureCard>
        <FeatureCardHeader className="text-accuracy">
          <FeatureCardHeaderContent>
            <FeatureCardIcon>
              <TargetIcon />
            </FeatureCardIcon>
            <FeatureCardLabel>{t("Accuracy")}</FeatureCardLabel>
          </FeatureCardHeaderContent>
          <FeatureCardIndicator />
        </FeatureCardHeader>

        <FeatureCardBody>
          <FeatureCardTitle>
            {t("{value}% correct answers", { value: formattedAccuracy })}
          </FeatureCardTitle>
          <FeatureCardSubtitle>{t("Past 3 months")}</FeatureCardSubtitle>
        </FeatureCardBody>
      </FeatureCard>
    </FeatureCardLink>
  );
}

export function AccuracySkeleton() {
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
