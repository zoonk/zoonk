"use client";

import { WorkflowRunFollower } from "@/lib/workflow/workflow-run-follower";
import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { type ExperienceMode } from "@zoonk/learn/experience-mode";
import { GenerationFollowerProvider } from "@zoonk/learn/generation/follower";
import { StartFlow } from "@zoonk/learn/onboarding";
import {
  WEB_ONBOARDING_ACTIONS,
  WEB_ONBOARDING_ROUTES,
  getPlanLinkOnboardingActions,
} from "./onboarding-client-actions";
import { useOnboardingNavigation } from "./use-onboarding-navigation";

export function StartClient({
  canAttach,
  defaultGoal,
  initialDraft,
  initialMode,
  planId,
}: {
  /** An account can attach material; guests and visitors are asked to create one. */
  canAttach: boolean;
  defaultGoal: string;
  initialDraft: OnboardingDraftView | null;
  initialMode: ExperienceMode;
  /** Someone's plan link this onboarding started from, if any. */
  planId: string | null;
}) {
  const navigation = useOnboardingNavigation();

  return (
    <GenerationFollowerProvider follower={WorkflowRunFollower}>
      <StartFlow
        actions={planId ? getPlanLinkOnboardingActions(planId) : WEB_ONBOARDING_ACTIONS}
        canAttach={canAttach}
        defaultGoal={defaultGoal}
        fromSharedPlan={planId !== null}
        initialDraft={initialDraft}
        initialMode={initialMode}
        navigation={navigation}
        routes={WEB_ONBOARDING_ROUTES}
      />
    </GenerationFollowerProvider>
  );
}
