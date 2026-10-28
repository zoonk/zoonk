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
  canAttach: boolean;
  defaultGoal: string;
  embedded?: boolean;
  goalLimit: GoalLimitReason | null;
  header?: React.ReactNode;
  initialDraft: OnboardingDraftView | null;
  needsAccount: boolean;
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
