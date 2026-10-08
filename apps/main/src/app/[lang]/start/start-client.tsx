"use client";

import { type TutorViewer } from "@/components/learn/main-ask-tutor";
import { WorkflowRunFollower } from "@/lib/workflow/workflow-run-follower";
import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { GenerationFollowerProvider } from "@zoonk/learn/generation/follower";
import { StartFlow } from "@zoonk/learn/onboarding";
import {
  WEB_ONBOARDING_ACTIONS,
  WEB_ONBOARDING_ROUTES,
  getPlanLinkOnboardingActions,
} from "./onboarding-client-actions";
import { useOnboardingNavigation } from "./use-onboarding-navigation";

export function StartClient({
  buddy,
  canAttach,
  defaultGoal,
  initialDraft,
  needsAccount,
  planId,
}: {
  /** The learner's buddy, who answers questions about their material; null before they pick one. */
  buddy: TutorViewer["buddy"];
  /** An account can attach material; guests and visitors are asked to create one. */
  canAttach: boolean;
  defaultGoal: string;
  initialDraft: OnboardingDraftView | null;
  /** A guest whose one goal is taken: only an account adds another. */
  needsAccount: boolean;
  /** Someone's plan link this onboarding started from, if any. */
  planId: string | null;
}) {
  const navigation = useOnboardingNavigation();

  return (
    <GenerationFollowerProvider follower={WorkflowRunFollower}>
      <StartFlow
        actions={planId ? getPlanLinkOnboardingActions(planId) : WEB_ONBOARDING_ACTIONS}
        buddy={buddy}
        canAttach={canAttach}
        defaultGoal={defaultGoal}
        fromSharedPlan={planId !== null}
        initialDraft={initialDraft}
        navigation={navigation}
        needsAccount={needsAccount}
        routes={WEB_ONBOARDING_ROUTES}
      />
    </GenerationFollowerProvider>
  );
}
