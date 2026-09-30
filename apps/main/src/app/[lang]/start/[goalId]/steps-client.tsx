"use client";

import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type PlanView } from "@zoonk/core/plans/view-contract";
import { type OnboardingView } from "@zoonk/core/view-models/onboarding/contract";
import { type ExperienceMode } from "@zoonk/learn/experience-mode";
import { type LearnBuddy } from "@zoonk/learn/navigation";
import { StepsFlow } from "@zoonk/learn/onboarding/steps";
import { type PlanActions } from "@zoonk/learn/plan";
import { getGenerationIdAction, retryGenerationAction } from "../onboarding-actions";
import { WEB_ONBOARDING_ACTIONS, WEB_ONBOARDING_ROUTES } from "../onboarding-client-actions";
import { useOnboardingNavigation } from "../use-onboarding-navigation";

export function StepsClient(props: {
  initialMode: ExperienceMode;
  initialPlan: PlanView | null;
  isGuest: boolean;
  onboarding: OnboardingView;
  buddy: LearnBuddy | null;
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
      testOutBasePath="/plan/test-out"
    />
  );
}
