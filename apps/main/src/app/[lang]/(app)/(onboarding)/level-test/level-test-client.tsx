"use client";

import { getLanguagePlanTestActions } from "@/app/[lang]/(app)/(onboarding)/start/language-plan-test-client-actions";
import { useRouter } from "@/i18n/navigation";
import { readWarmUp } from "@/lib/goals/read-warm-up";
import { LanguagePlanTestFlow } from "@zoonk/learn/language/level-test-flow";
import { OnboardingFrame } from "@zoonk/learn/onboarding/frame";

export function LevelTestClient({
  goalId,
  testOutFirst,
  targetLanguage,
  testOutLevel,
}: {
  goalId: string;
  /** Opened from a lesson's offer to test out of a level, so that choice comes picked. */
  testOutFirst: boolean;
  targetLanguage: string;
  testOutLevel: string | null;
}) {
  const router = useRouter();

  const leaveTo = async (href: "/plan" | `/learn/${string}`) => {
    router.push(href);
    return true;
  };

  return (
    <OnboardingFrame>
      <LanguagePlanTestFlow
        actions={getLanguagePlanTestActions(goalId)}
        goalId={goalId}
        host={{ surface: "plan" }}
        onLeave={() => leaveTo("/plan")}
        onStartLesson={(lessonId) => leaveTo(`/learn/${lessonId}`)}
        readWarmUp={readWarmUp}
        targetLanguage={targetLanguage}
        testOutFirst={testOutFirst}
        testOutLevel={testOutLevel}
        trueFalseLabels="trueFalse"
      />
    </OnboardingFrame>
  );
}
