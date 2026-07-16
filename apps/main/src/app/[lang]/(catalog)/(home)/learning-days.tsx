import { getProgressDayCountLabel } from "@/components/progress/progress-day-count-label";
import { Link } from "@/i18n/navigation";
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
import { CalendarDays } from "lucide-react";
import { getExtracted } from "next-intl/server";

/**
 * The homepage shows the lifetime learning-day count next to Level because it
 * describes consistency behind Brain Power, not the recent score window.
 */
export async function LearningDays({ learningDays }: { learningDays: number }) {
  const t = await getExtracted();
  const levelMenu = getMenu("level");
  const countLabel = await getProgressDayCountLabel({ count: learningDays });

  return (
    <FeatureCardLink render={<Link href={levelMenu.url} prefetch />}>
      <FeatureCard aria-labelledby="home-learning-days-label">
        <FeatureCardHeader>
          <FeatureCardHeaderContent>
            <FeatureCardIcon>
              <CalendarDays />
            </FeatureCardIcon>
            <FeatureCardLabel id="home-learning-days-label">{t("Learning days")}</FeatureCardLabel>
          </FeatureCardHeaderContent>
          <FeatureCardIndicator />
        </FeatureCardHeader>

        <FeatureCardBody>
          <FeatureCardTitle>{countLabel}</FeatureCardTitle>
          <FeatureCardSubtitle>{t("At least one completed lesson")}</FeatureCardSubtitle>
        </FeatureCardBody>
      </FeatureCard>
    </FeatureCardLink>
  );
}

/**
 * Keep the homepage grid stable while the lifetime learning-day total loads.
 */
export function LearningDaysSkeleton() {
  return (
    <FeatureCard className="w-full">
      <Skeleton className="h-5 w-28" />

      <FeatureCardBody className="gap-1">
        <Skeleton className="h-4 w-full max-w-24" />
        <Skeleton className="h-3 w-full max-w-48" />
      </FeatureCardBody>
    </FeatureCard>
  );
}
