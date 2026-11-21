"use client";

import { readWarmUpAction } from "@/app/[lang]/(app)/(onboarding)/start/onboarding-actions";
import { getPlacementTestActions } from "@/app/[lang]/(app)/(onboarding)/start/placement-test-client-actions";
import { useRouter } from "@/i18n/navigation";
import { OnboardingFrame } from "@zoonk/learn/onboarding/frame";
import { PlacementTestFlow } from "@zoonk/learn/placement-test";

export function PlacementTestClient({
  goalId,
  subject,
  wholeCourseMinutes,
}: {
  goalId: string;
  subject: string;
  wholeCourseMinutes: number;
}) {
  const router = useRouter();

  // The pages kept from before were read before the test changed the plan.
  const leave = async () => {
    router.push("/plan");
    router.refresh();
    return true;
  };

  return (
    <OnboardingFrame>
      <PlacementTestFlow
        actions={getPlacementTestActions(goalId)}
        onDone={leave}
        readWarmUp={readWarmUpAction}
        subject={subject}
        wholeCourseMinutes={wholeCourseMinutes}
      />
    </OnboardingFrame>
  );
}
