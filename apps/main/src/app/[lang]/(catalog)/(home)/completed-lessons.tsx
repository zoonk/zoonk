import {
  CompletedLessonsCard,
  CompletedLessonsCardSkeleton,
} from "@/components/progress/completed-lessons-card";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { FeatureCardIndicator, FeatureCardLink } from "@zoonk/ui/components/feature";
import { getExtracted } from "next-intl/server";

/**
 * The homepage links the lifetime completed-lesson total to Activity, where the
 * learner can see how those completions are distributed across calendar days.
 */
export async function CompletedLessons({ completedLessons }: { completedLessons: number }) {
  const t = await getExtracted();
  const activityMenu = getMenu("activity");

  return (
    <FeatureCardLink render={<Link href={activityMenu.url} prefetch />}>
      <CompletedLessonsCard
        completedLessons={completedLessons}
        labelId="home-completed-lessons-label"
        subtitle={t("All time")}
        trailing={<FeatureCardIndicator />}
      />
    </FeatureCardLink>
  );
}

/**
 * Keep the homepage grid stable while the completed-lesson total loads.
 */
export function CompletedLessonsSkeleton() {
  return <CompletedLessonsCardSkeleton />;
}
