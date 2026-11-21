"use client";

import {
  answerLevelTestAction,
  speakLevelTestAction,
  startLevelTestBankAction,
} from "@/app/[lang]/(app)/(onboarding)/start/language-level-test-actions";
import { useRouter } from "@/i18n/navigation";
import {
  type LanguagePlanTestActions,
  LanguagePlanTestFlow,
} from "@zoonk/learn/language/level-test-flow";
import { OnboardingFrame } from "@zoonk/learn/onboarding/frame";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import {
  answerLevelTestOutAction,
  finishLevelTestAttemptAction,
  finishLevelTestOutAction,
  getLevelTestAttemptAction,
  startLevelTestAttemptAction,
  startLevelTestOutAction,
  walkLevelTestTopicsAction,
} from "./level-test-plan-actions";

function getActions({
  goalId,
  walked,
}: {
  goalId: string;
  walked: () => void;
}): LanguagePlanTestActions {
  return {
    answer: (input) => answerLevelTestAction(goalId, input),
    finish: (attemptId) => finishLevelTestAttemptAction(goalId, attemptId),
    get: () => getLevelTestAttemptAction(goalId),
    prepare: () => startLevelTestBankAction(goalId),
    speak: (audio) => {
      const form = new FormData();
      form.set("audio", audio);
      return speakLevelTestAction(goalId, form);
    },
    start: (length) => startLevelTestAttemptAction(goalId, length),
    testOut: {
      answer: (input) =>
        answerLevelTestOutAction(goalId, { ...input, timeZone: getLocalTimeZone() }),
      finish: (attemptId) => finishLevelTestOutAction(goalId, attemptId),
      start: (level) => startLevelTestOutAction(goalId, level),
    },
    walkTopics: async () => {
      const opened = await walkLevelTestTopicsAction(goalId, getLocalTimeZone());

      if (opened) {
        walked();
      }

      return opened;
    },
  };
}

export function LevelTestClient({
  goalId,
  targetLanguage,
  testOutLevel,
  wholeCourseMinutes,
}: {
  goalId: string;
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
        actions={getActions({ goalId, walked: () => router.push("/placement-test") })}
        onDone={leave}
        targetLanguage={targetLanguage}
        testOutLevel={testOutLevel}
        trueFalseLabels="trueFalse"
        wholeCourseMinutes={wholeCourseMinutes}
      />
    </OnboardingFrame>
  );
}
