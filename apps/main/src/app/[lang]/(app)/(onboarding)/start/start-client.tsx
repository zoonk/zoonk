"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { WorkflowRunFollower } from "@/lib/workflow/workflow-run-follower";
import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { GenerationFollowerProvider } from "@zoonk/learn/generation/follower";
import { StartFlow } from "@zoonk/learn/onboarding";
import { type GoalLimitReason } from "@zoonk/learn/onboarding/actions";
import { OnboardingEmbedded } from "@zoonk/learn/onboarding/frame";
import {
  WEB_ONBOARDING_ACTIONS,
  WEB_ONBOARDING_ROUTES,
  getPlanLinkOnboardingActions,
} from "./onboarding-client-actions";
import { useOnboardingNavigation } from "./use-onboarding-navigation";

export function StartClient({
  canAttach,
  defaultGoal,
  embedded = false,
  goalLimit,
  header,
  initialDraft,
  needsAccount,
  planId,
}: {
  /** An account can attach material; guests and visitors are asked to create one. */
  canAttach: boolean;
  defaultGoal: string;
  /** Under a host page's title (Today without a goal), as that page's section. */
  embedded?: boolean;
  /** A goal limit the learner already reached, said before they type. */
  goalLimit: GoalLimitReason | null;
  /** The host page's top over the flow when `embedded`, such as Today's title. */
  header?: React.ReactNode;
  initialDraft: OnboardingDraftView | null;
  /** A guest whose one goal is taken: only an account adds another. */
  needsAccount: boolean;
  /** Someone's plan link this onboarding started from, if any. */
  planId: string | null;
}) {
  const navigation = useOnboardingNavigation();
  // An unknown summary leaves answers without a buddy identity until the actual one arrives.
  const learner = useLearnerSummary();
  const buddy = learner.status === "ready" ? learner.summary.buddy : undefined;

  const flow = (
    <GenerationFollowerProvider follower={WorkflowRunFollower}>
      <StartFlow
        actions={planId ? getPlanLinkOnboardingActions(planId) : WEB_ONBOARDING_ACTIONS}
        buddy={buddy}
        canAttach={canAttach}
        defaultGoal={defaultGoal}
        fromSharedPlan={planId !== null}
        goalLimit={goalLimit}
        initialDraft={initialDraft}
        navigation={navigation}
        needsAccount={needsAccount}
        routes={WEB_ONBOARDING_ROUTES}
      />
    </GenerationFollowerProvider>
  );

  return embedded ? <OnboardingEmbedded header={header}>{flow}</OnboardingEmbedded> : flow;
}
