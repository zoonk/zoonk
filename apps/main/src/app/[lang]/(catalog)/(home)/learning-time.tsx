import {
  TotalLearningTimeCard,
  TotalLearningTimeCardSkeleton,
} from "@/components/progress/total-learning-time-card";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { FeatureCardIndicator, FeatureCardLink } from "@zoonk/ui/components/feature";
import { getExtracted } from "next-intl/server";

/**
 * The homepage places lifetime learning time next to learning days because both
 * describe the learner's all-time lesson activity behind their level progress.
 */
export async function LearningTime({ totalLearningSeconds }: { totalLearningSeconds: number }) {
  const t = await getExtracted();
  const levelMenu = getMenu("level");

  return (
    <FeatureCardLink render={<Link href={levelMenu.url} prefetch />}>
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
