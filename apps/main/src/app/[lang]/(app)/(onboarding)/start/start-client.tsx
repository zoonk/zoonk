"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { useResetWhenDone } from "@/lib/use-reset-when-done";
import { WorkflowRunFollower } from "@/lib/workflow/workflow-run-follower";
import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { GenerationFollowerProvider } from "@zoonk/learn/generation/follower";
import { StartFlow } from "@zoonk/learn/onboarding";
import { type GoalLimitReason } from "@zoonk/learn/onboarding/actions";
import { OnboardingEmbedded } from "@zoonk/learn/onboarding/frame";
import {
  WEB_ONBOARDING_ACTIONS,
  getPlanLinkOnboardingActions,
  useWebOnboardingRoutes,
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
  const reset = useResetWhenDone();
  // The goal made here used the words and draft this page opened with.
  const opensEmpty = reset.key > 0;
  const { toExplanation, toSteps, ...navigation } = useOnboardingNavigation();

  // Back comes to the empty box, not to the used draft's address: that redirects to its goal, and
  // Next replays the redirect the next time this page opens (vercel/next.js#92767).
  const leaveForGoal = () => {
    reset.done();
    navigation.showDraft(null);
  };

  const routes = useWebOnboardingRoutes();
  // An unknown summary leaves answers without a buddy identity until the actual one arrives.
  const learner = useLearnerSummary();
  const buddy = learner.status === "ready" ? learner.summary.buddy : undefined;

  const flow = (
    <GenerationFollowerProvider follower={WorkflowRunFollower}>
      <StartFlow
        key={reset.key}
        actions={planId ? getPlanLinkOnboardingActions(planId) : WEB_ONBOARDING_ACTIONS}
        buddy={buddy}
        canAttach={canAttach}
        defaultGoal={opensEmpty ? "" : defaultGoal}
        fromSharedPlan={planId !== null}
        goalLimit={goalLimit}
        initialDraft={opensEmpty ? null : initialDraft}
        navigation={{
          ...navigation,
          toExplanation: (goalId) => {
            leaveForGoal();
            toExplanation(goalId);
          },
          toSteps: (goalId) => {
            leaveForGoal();
            toSteps(goalId);
          },
        }}
        needsAccount={needsAccount}
        routes={routes}
        takesHandedOffGoal={!embedded}
      />
    </GenerationFollowerProvider>
  );

  return embedded ? <OnboardingEmbedded header={header}>{flow}</OnboardingEmbedded> : flow;
}
