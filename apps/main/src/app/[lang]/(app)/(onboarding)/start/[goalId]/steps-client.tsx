"use client";

import { useFrameLearner } from "@/components/learner/learner-seed-provider";
import { getGoalBasesAdvice } from "@/lib/goals/goal-bases-advice";
import { findGoalTimeToCover } from "@/lib/goals/goal-time-advice";
import { readGoalGenerationId } from "@/lib/goals/read-goal-generation-id";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { WorkflowRunFollower } from "@/lib/workflow/workflow-run-follower";
import { type OnboardingView } from "@zoonk/core/view-models/onboarding/contract";
import { GenerationFollowerProvider } from "@zoonk/learn/generation/follower";
import { type PlanActions } from "@zoonk/learn/journey";
import { type RevealedPlan } from "@zoonk/learn/onboarding/actions";
import { StepsFlow } from "@zoonk/learn/onboarding/steps";
import { retryGenerationAction } from "../onboarding-actions";
import { WEB_ONBOARDING_ACTIONS, useWebOnboardingRoutes } from "../onboarding-client-actions";
import { useOnboardingNavigation } from "../use-onboarding-navigation";

export function StepsClient(props: {
  initialPlan: RevealedPlan | null;
  isGuest: boolean;
  onboarding: OnboardingView;
  planActions: Omit<PlanActions, "adviseOnBases" | "findTimeToCover">;
}) {
  const navigation = useOnboardingNavigation();
  const routes = useWebOnboardingRoutes();
  const learner = useFrameLearner();
  const goalId = props.onboarding.goal.id;

  const generation = useWorkflowRun({
    generationId: props.onboarding.generationId,
    kind: "placement",
    readGenerationId: () => readGoalGenerationId(goalId),
    restart: () => retryGenerationAction(goalId),
  });

  return (
    <GenerationFollowerProvider follower={WorkflowRunFollower}>
      <StepsFlow
        {...props}
        actions={WEB_ONBOARDING_ACTIONS}
        buddy={learner.status === "ready" ? learner.summary.buddy : null}
        planActions={{
          ...props.planActions,
          adviseOnBases: () => getGoalBasesAdvice(goalId),
          // The API saves the choice, so unlike the other changes nothing drops the pages kept.
          chooseTools: async (input) => {
            const chosen = await props.planActions.chooseTools(input);

            if (chosen === true) {
              navigation.refreshPages();
            }

            return chosen;
          },
          findTimeToCover: () => findGoalTimeToCover({ goalId }),
        }}
        generation={generation}
        navigation={navigation}
        routes={routes}
      />
    </GenerationFollowerProvider>
  );
}
