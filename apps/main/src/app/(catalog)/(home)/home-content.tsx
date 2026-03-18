import { getBeltLevel } from "@/data/progress/get-belt-level";
import { Suspense } from "react";
import { ContinueLearningList, ContinueLearningSkeleton } from "./continue-learning";
import { Hero } from "./hero";
import { Performance, PerformanceSkeleton } from "./performance";

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

      <Suspense fallback={<PerformanceSkeleton />}>
        <Performance />
      </Suspense>
    </>
  );
}

export function HomeContentSkeleton() {
  return (
    <>
      <ContinueLearningSkeleton />
      <PerformanceSkeleton />
    </>
  );
}
