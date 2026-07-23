import {
  LearningDaysCard,
  LearningDaysCardSkeleton,
} from "@/components/progress/learning-days-card";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { FeatureCardIndicator, FeatureCardLink } from "@zoonk/ui/components/feature";
import { getExtracted } from "next-intl/server";

/**
 * The homepage links its lifetime learning-day summary to the Activity page,
 * where the learner can see the daily lesson calendar behind that total.
 */
export async function LearningDays({ learningDays }: { learningDays: number }) {
  const t = await getExtracted();
  const activityMenu = getMenu("activity");

  return (
    <FeatureCardLink render={<Link href={activityMenu.url} prefetch />}>
      <LearningDaysCard
        count={learningDays}
        labelId="home-learning-days-label"
        subtitle={t("At least one completed lesson")}
        trailing={<FeatureCardIndicator />}
      />
    </FeatureCardLink>
  );
}

/**
 * Keep the homepage grid stable while the lifetime learning-day total loads.
 */
export function LearningDaysSkeleton() {
  return <LearningDaysCardSkeleton />;
}
