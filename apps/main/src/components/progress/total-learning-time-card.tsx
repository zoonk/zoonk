import {
  FeatureCard,
  FeatureCardBody,
  FeatureCardHeader,
  FeatureCardHeaderContent,
  FeatureCardIcon,
  FeatureCardLabel,
  FeatureCardSubtitle,
  FeatureCardTitle,
} from "@zoonk/ui/components/feature";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ClockIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { getProgressLearningTimeLabel } from "./progress-learning-time-label";

/**
 * Learning time appears on multiple progress surfaces, so this shared card
 * keeps the learner-facing label, icon, and duration formatting aligned.
 */
export async function TotalLearningTimeCard({
  labelId,
  subtitle,
  totalLearningSeconds,
  trailing,
}: {
  labelId?: string;
  subtitle: string;
  totalLearningSeconds: number;
  trailing?: ReactNode;
}) {
  const t = await getExtracted();
  const timeLabel = await getProgressLearningTimeLabel({ totalSeconds: totalLearningSeconds });

  return (
    <FeatureCard aria-labelledby={labelId}>
      <FeatureCardHeader>
        <FeatureCardHeaderContent>
          <FeatureCardIcon>
            <ClockIcon />
          </FeatureCardIcon>
          <FeatureCardLabel id={labelId}>{t("Learning time")}</FeatureCardLabel>
        </FeatureCardHeaderContent>
        {trailing}
      </FeatureCardHeader>

      <FeatureCardBody>
        <FeatureCardTitle>{timeLabel}</FeatureCardTitle>
        <FeatureCardSubtitle>{subtitle}</FeatureCardSubtitle>
      </FeatureCardBody>
    </FeatureCard>
  );
}

/**
 * The progress grids reserve the same footprint for the total-time card while
 * server data streams in, which prevents the surrounding cards from shifting.
 */
export function TotalLearningTimeCardSkeleton() {
  return (
    <FeatureCard className="w-full">
      <Skeleton className="h-5 w-36" />

      <FeatureCardBody className="gap-1">
        <Skeleton className="h-4 w-full max-w-20" />
        <Skeleton className="h-3 w-full max-w-36" />
      </FeatureCardBody>
    </FeatureCard>
  );
}
