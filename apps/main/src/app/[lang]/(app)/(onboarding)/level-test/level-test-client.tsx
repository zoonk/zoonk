"use client";

import { getLanguagePlanTestActions } from "@/app/[lang]/(app)/(onboarding)/start/language-plan-test-client-actions";
import { useRouter } from "@/i18n/navigation";
import { readWarmUp } from "@/lib/goals/read-warm-up";
import { LanguagePlanTestFlow } from "@zoonk/learn/language/level-test-flow";
import { OnboardingFrame } from "@zoonk/learn/onboarding/frame";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { walkLevelTestTopicsAction } from "./level-test-plan-actions";

export function LevelTestClient({
  goalId,
  testOutFirst,
  targetLanguage,
  testOutLevel,
  wholeCourseMinutes,
}: {
  goalId: string;
  /** Opened from a lesson's offer to test out of a level, so that choice comes picked. */
  testOutFirst: boolean;
  targetLanguage: string;
  testOutLevel: string | null;
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
      <LanguagePlanTestFlow
        actions={getLanguagePlanTestActions({
          goalId,
          walkTopics: async () => {
            const opened = await walkLevelTestTopicsAction(goalId, getLocalTimeZone());

            if (opened) {
              router.push("/placement-test");
            }

            return opened;
          },
        })}
        onDone={leave}
        readWarmUp={readWarmUp}
        targetLanguage={targetLanguage}
        testOutFirst={testOutFirst}
        testOutLevel={testOutLevel}
        trueFalseLabels="trueFalse"
        wholeCourseMinutes={wholeCourseMinutes}
      />
    </OnboardingFrame>
  );
}
