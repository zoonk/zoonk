"use client";

import { getPlacementTestActions } from "@/app/[lang]/(app)/(onboarding)/start/placement-test-client-actions";
import { useRouter } from "@/i18n/navigation";
import { readWarmUp } from "@/lib/goals/read-warm-up";
import { OnboardingFrame } from "@zoonk/learn/onboarding/frame";
import { FocusTestSkeleton } from "@zoonk/learn/onboarding/skeletons";
import { PlacementTestFlow } from "@zoonk/learn/placement-test";
import { useEffect, useState } from "react";

export function PlacementTestClient({
  arrivesAtLevelTest,
  goalId,
  subject,
  wholeCourseMinutes,
}: {
  /**
   * A language course's test starts with its level; only its whole-course topic walk is here. Read
   * on arrival only: finishing the walk re-renders this page with no walk open, under its result.
   */
  arrivesAtLevelTest: boolean;
  goalId: string;
  subject: string;
  wholeCourseMinutes: number;
}) {
  const router = useRouter();
  // oxlint-disable-next-line react/hook-use-state -- Read once as the page opens, never updated.
  const [toLevelTest] = useState(arrivesAtLevelTest);

  useEffect(() => {
    if (toLevelTest) {
      router.replace("/level-test");
    }
  }, [router, toLevelTest]);

  // The pages kept from before were read before the test changed the plan.
  const leave = async () => {
    router.push("/plan");
    router.refresh();
    return true;
  };

  if (toLevelTest) {
    return <FocusTestSkeleton />;
  }

  return (
    <OnboardingFrame>
      <PlacementTestFlow
        actions={getPlacementTestActions(goalId)}
        onDone={leave}
        readWarmUp={readWarmUp}
        subject={subject}
        wholeCourseMinutes={wholeCourseMinutes}
      />
    </OnboardingFrame>
  );
}
