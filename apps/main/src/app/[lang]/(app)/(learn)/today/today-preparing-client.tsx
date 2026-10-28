"use client";

import { retryGenerationAction } from "@/app/[lang]/(app)/(onboarding)/start/onboarding-actions";
import { useRouter } from "@/i18n/navigation";
import { readGoalGenerationId } from "@/lib/goals/read-goal-generation-id";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { TodayPreparing } from "@zoonk/learn/today/preparing";

/**
 * The wait while the goal's plan is built: it follows the goal's run live and reads Today again
 * once the plan is ready. "Try again" starts the run again only when the learner taps it. Its own
 * module, so the wait's code loads only for a goal being prepared, not with every learner's day.
 */
export function TodayPreparingClient({ goalId, goalTitle }: { goalId: string; goalTitle: string }) {
  const router = useRouter();

  const run = useWorkflowRun({
    generationId: null,
    kind: "firstLesson",
    onReady: () => router.refresh(),
    readGenerationId: () => readGoalGenerationId(goalId),
    restart: () => retryGenerationAction(goalId),
  });

  return <TodayPreparing goalTitle={goalTitle} onRefresh={() => router.refresh()} run={run} />;
}
