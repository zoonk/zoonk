"use client";

import { getGoalBasesAdvice } from "@/lib/goals/goal-bases-advice";
import { findGoalTimeToCover } from "@/lib/goals/goal-time-advice";
import { readGoalGenerationId } from "@/lib/goals/read-goal-generation-id";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type OnboardingView } from "@zoonk/core/view-models/onboarding/contract";
import { type PlanActions } from "@zoonk/learn/journey";
import { type RevealedPlan } from "@zoonk/learn/onboarding/actions";
import { StepsFlow } from "@zoonk/learn/onboarding/steps";
import { retryGenerationAction } from "../onboarding-actions";
import { WEB_ONBOARDING_ACTIONS, WEB_ONBOARDING_ROUTES } from "../onboarding-client-actions";
import { useOnboardingNavigation } from "../use-onboarding-navigation";

export function StepsClient(props: {
  initialPlan: RevealedPlan | null;
  isGuest: boolean;
  onboarding: OnboardingView;
  planActions: Omit<PlanActions, "adviseOnBases" | "findTimeToCover">;
}) {
  const navigation = useOnboardingNavigation();
  const goalId = props.onboarding.goal.id;

  const generation = useWorkflowRun({
    generationId: props.onboarding.generationId,
    kind: "placement",
    readGenerationId: () => readGoalGenerationId(goalId),
    restart: () => retryGenerationAction(goalId),
  });

  return (
    <StepsFlow
      {...props}
      actions={WEB_ONBOARDING_ACTIONS}
      planActions={{
        ...props.planActions,
        adviseOnBases: () => getGoalBasesAdvice(goalId),
        findTimeToCover: () => findGoalTimeToCover({ goalId }),
      }}
      generation={generation}
      navigation={navigation}
      routes={WEB_ONBOARDING_ROUTES}
    />
  );
}
