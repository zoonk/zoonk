"use client";

import { decidePlanChangeAction } from "@/app/[lang]/(app)/(learn)/plan/journey-actions";
import { getFocusTestActions } from "@/app/[lang]/(app)/(onboarding)/start/focus-test-client-actions";
import { readWarmUpAction } from "@/app/[lang]/(app)/(onboarding)/start/onboarding-actions";
import { useRouter } from "@/i18n/navigation";
import { WorkflowRunFollower } from "@/lib/workflow/workflow-run-follower";
import { FocusTestFlow } from "@zoonk/learn/focus-test";
import { GenerationFollowerProvider } from "@zoonk/learn/generation/follower";
import { OnboardingFrame } from "@zoonk/learn/onboarding/frame";
import { useMemo } from "react";

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
  const actions = useMemo(() => getFocusTestActions(goalId), [goalId]);

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
          actions={actions}
          host="plan"
          onDone={leave}
          plan={{
            changeFocusHref: "/plan?focus=choose",
            decide: (input) => decidePlanChangeAction(goalId, input),
          }}
          readWarmUp={readWarmUpAction}
          run={null}
          subject={subject}
        />
      </OnboardingFrame>
    </GenerationFollowerProvider>
  );
}
