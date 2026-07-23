import {
  TotalLearningTimeCard,
  TotalLearningTimeCardSkeleton,
} from "@/components/progress/total-learning-time-card";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { FeatureCardIndicator, FeatureCardLink } from "@zoonk/ui/components/feature";
import { getExtracted } from "next-intl/server";

/**
 * The homepage links lifetime learning time to the Activity page so its
 * detailed calendar and related totals stay together.
 */
export async function LearningTime({ totalLearningSeconds }: { totalLearningSeconds: number }) {
  const t = await getExtracted();
  const activityMenu = getMenu("activity");

  return (
    <FeatureCardLink render={<Link href={activityMenu.url} prefetch />}>
      <TotalLearningTimeCard
        labelId="home-total-learning-time-label"
        subtitle={t("Time spent in lessons")}
        totalLearningSeconds={totalLearningSeconds}
        trailing={<FeatureCardIndicator />}
      />
    </FeatureCardLink>
  );
}

/**
 * Keep the homepage grid stable while the lifetime learning-time total loads.
 */
export function LearningTimeSkeleton() {
  return <TotalLearningTimeCardSkeleton />;
}
