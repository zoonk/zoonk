import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { Suspense } from "react";
import { StartContent } from "../start/start-content";
import { ContinueLearningList, ContinueLearningSkeleton } from "./continue-learning";
import { Progress, ProgressSkeleton } from "./progress";

/**
 * Resolves only the prerequisite shared by the start and continue-learning
 * surfaces, so unrelated progress metrics cannot delay the primary content.
 */
async function LearningContent() {
  const beltData = await getBeltLevel();

  if (!beltData) {
    return <StartContent />;
  }

  return <ContinueLearningList />;
}

/**
 * Starts the primary content and progress capabilities as independent siblings
 * so Cache Components can prefetch both branches in the same render wave.
 */
export function HomeContent() {
  return (
    <>
      <Suspense fallback={<ContinueLearningSkeleton />}>
        <LearningContent />
      </Suspense>

      <Suspense fallback={<ProgressSkeleton />}>
        <Progress />
      </Suspense>
    </>
  );
}
