import { getBeltLevel } from "@/data/progress/get-belt-level";
import { Suspense } from "react";
import { LearnContent } from "../learn/learn-content";
import { ContinueLearningList, ContinueLearningSkeleton } from "./continue-learning";
import { Progress, ProgressSkeleton } from "./progress";

/**
 * Shows progress for learners who have started and reuses the goal form for
 * visitors or learners who still need to choose what to learn first.
 */
export async function HomeContent() {
  const beltData = await getBeltLevel();

  if (!beltData) {
    return <LearnContent />;
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
