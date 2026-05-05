import { getBeltLevel } from "@/data/progress/get-belt-level";
import { Suspense } from "react";
import { ContinueLearningList, ContinueLearningSkeleton } from "./continue-learning";
import { Hero } from "./hero";
import { Progress, ProgressSkeleton } from "./progress";

export async function HomeContent() {
  const beltData = await getBeltLevel();

  if (!beltData) {
    return <Hero />;
  }

  return (
    <>
      <Suspense fallback={<ContinueLearningSkeleton />}>
        <ContinueLearningList />
      </Suspense>

      <Suspense fallback={<ProgressSkeleton />}>
        <Progress />
      </Suspense>
    </>
  );
}

export function HomeContentSkeleton() {
  return (
    <>
      <ContinueLearningSkeleton />
      <ProgressSkeleton />
    </>
  );
}
