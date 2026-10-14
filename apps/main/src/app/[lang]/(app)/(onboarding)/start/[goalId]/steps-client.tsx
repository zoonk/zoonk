"use client";

import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type OnboardingView } from "@zoonk/core/view-models/onboarding/contract";
import { type PlanActions } from "@zoonk/learn/journey";
import { type RevealedPlan } from "@zoonk/learn/onboarding/actions";
import { StepsFlow } from "@zoonk/learn/onboarding/steps";
import { getGenerationIdAction, retryGenerationAction } from "../onboarding-actions";
import { WEB_ONBOARDING_ACTIONS, WEB_ONBOARDING_ROUTES } from "../onboarding-client-actions";
import { useOnboardingNavigation } from "../use-onboarding-navigation";

export function StepsClient(props: {
  initialPlan: RevealedPlan | null;
  isGuest: boolean;
  onboarding: OnboardingView;
  planActions: PlanActions;
}) {
  const navigation = useOnboardingNavigation();
  const goalId = props.onboarding.goal.id;

  // The curriculum is written while the learner answers; the waiting screens follow it live.
  const generation = useWorkflowRun({
    generationId: props.onboarding.generationId,
    kind: "placement",
    readGenerationId: () => getGenerationIdAction(goalId),
    restart: () => retryGenerationAction(goalId),
  });

  return (
    <StepsFlow
      {...props}
      actions={WEB_ONBOARDING_ACTIONS}
      generation={generation}
      navigation={navigation}
      routes={WEB_ONBOARDING_ROUTES}
    />
  );
}
