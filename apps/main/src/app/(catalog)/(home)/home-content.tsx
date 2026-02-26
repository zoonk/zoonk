import { getContinueLearning } from "@/data/courses/get-continue-learning";
import { Suspense } from "react";
import { ContinueLearningList, ContinueLearningSkeleton } from "./continue-learning";
import { Hero } from "./hero";
import { Performance, PerformanceSkeleton } from "./performance";

export async function HomeContent() {
  const items = await getContinueLearning();

  if (items.length === 0) {
    return <Hero />;
  }

  return (
    <>
      <Suspense fallback={<ContinueLearningSkeleton />}>
        <ContinueLearningList items={items} />
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
