"use client";

import {
  getGenerationIdAction,
  retryGenerationAction,
} from "@/app/[lang]/start/onboarding-actions";
import { useRouter } from "@/i18n/navigation";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { PlanBuilding, PlanScreen } from "@zoonk/learn/plan";

/**
 * The plan while the goal's run builds it: it follows the run live and reads the plan again once
 * it's saved. "Try again" starts the run again only when the learner taps it.
 */
export function PlanBuildingClient({ goalId }: { goalId: string }) {
  const router = useRouter();

  const run = useWorkflowRun({
    generationId: null,
    kind: "curriculum",
    onReady: () => router.refresh(),
    readGenerationId: () => getGenerationIdAction(goalId),
    restart: () => retryGenerationAction(goalId),
  });

  return <PlanBuilding onRefresh={() => router.refresh()} run={run} />;
}

/** The plan, read again while lessons in it are still being written. */
export function PlanScreenClient(props: Omit<React.ComponentProps<typeof PlanScreen>, "refresh">) {
  const router = useRouter();
  return <PlanScreen {...props} refresh={() => router.refresh()} />;
}
