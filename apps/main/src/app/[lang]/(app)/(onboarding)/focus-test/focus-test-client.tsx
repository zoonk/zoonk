"use client";

import { answerPlanChangeAction } from "@/app/[lang]/(app)/(learn)/plan/journey-actions";
import { getFocusTestActions } from "@/app/[lang]/(app)/(onboarding)/start/focus-test-client-actions";
import { useRouter } from "@/i18n/navigation";
import { updateFocusTestAction } from "@/lib/focus-test/focus-test-controls";
import { readWarmUp } from "@/lib/goals/read-warm-up";
import { WorkflowRunFollower } from "@/lib/workflow/workflow-run-follower";
import { FocusTestFlow } from "@zoonk/learn/focus-test";
import { GenerationFollowerProvider } from "@zoonk/learn/generation/follower";
import { OnboardingFrame } from "@zoonk/learn/onboarding/frame";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";

export function FocusTestClient({
  backHref,
  goalId,
  subject,
}: {
  backHref: "/plan" | `/start/${string}`;
  goalId: string;
  subject: string;
}) {
  const router = useRouter();

  // The pages kept from before were read before the test changed the plan.
  const leave = async () => {
    router.push(backHref);
    router.refresh();
    return true;
  };

  return (
    <GenerationFollowerProvider follower={WorkflowRunFollower}>
      <OnboardingFrame>
        <FocusTestFlow
          actions={getFocusTestActions(goalId)}
          goalId={goalId}
          host="plan"
          onDone={leave}
          plan={{
            changeFocusHref: "/plan?focus=choose",
            decide: (input) => answerPlanChangeAction(goalId, input),
            setSessionQuestions: (sessionQuestions) =>
              updateFocusTestAction(goalId, { sessionQuestions, timeZone: getLocalTimeZone() }),
          }}
          readWarmUp={readWarmUp}
          run={null}
          subject={subject}
        />
      </OnboardingFrame>
    </GenerationFollowerProvider>
  );
}
