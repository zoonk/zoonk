"use client";

import { getPlacementTestActions } from "@/app/[lang]/(app)/(onboarding)/start/placement-test-client-actions";
import { useRouter } from "@/i18n/navigation";
import { readWarmUp } from "@/lib/goals/read-warm-up";
import { OnboardingFrame } from "@zoonk/learn/onboarding/frame";
import { PlacementTestFlow } from "@zoonk/learn/placement-test";

export function PlacementTestClient({
  goalId,
  offer,
  subject,
}: {
  goalId: string;
  offer: React.ComponentProps<typeof PlacementTestFlow>["offer"];
  subject: string;
}) {
  const router = useRouter();

  const leaveTo = async (href: "/plan" | `/learn/${string}`) => {
    router.push(href);
    return true;
  };

  return (
    <OnboardingFrame>
      <PlacementTestFlow
        actions={getPlacementTestActions(goalId)}
        goalId={goalId}
        host={{ surface: "plan" }}
        offer={offer}
        onLeave={() => leaveTo("/plan")}
        onStartLesson={(lessonId) => leaveTo(`/learn/${lessonId}`)}
        readWarmUp={readWarmUp}
        subject={subject}
      />
    </OnboardingFrame>
  );
}
