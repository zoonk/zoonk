"use client";

import { useRouter } from "@/i18n/navigation";
import { trackEvent } from "@zoonk/core/analytics/client";
import { useAppLocale } from "@zoonk/learn/locale";
import { type StartUnderstandingOutcome } from "@zoonk/learn/onboarding/actions";
import {
  type OnboardingAttempt,
  startOnboardingAttempt,
} from "@zoonk/learn/onboarding/attempt-clock";
import { handOffGoal, sendGoal } from "@zoonk/learn/onboarding/understanding-start";
import { safeAsync } from "@zoonk/utils/error";

/** Loaded on the first tap, so the page doesn't ship the account and actions code to visitors who only read. */
async function sendHomeGoal({
  attempt,
  goal,
  language,
}: {
  attempt: OnboardingAttempt;
  goal: string;
  language: string;
}): Promise<StartUnderstandingOutcome> {
  const { data: actions } = await safeAsync(
    () => import("@/app/[lang]/(app)/(onboarding)/start/understanding-client-actions"),
  );

  if (!actions) {
    return { status: "failed" };
  }

  return sendGoal({ attempt, goal, language, understanding: actions.WEB_UNDERSTANDING_ACTIONS });
}

/** `/start` opens at once and shows the goal on its way, then what was understood or what went wrong. */
export function useSendGoal() {
  const locale = useAppLocale();
  const router = useRouter();

  return (goal: string) => {
    const attempt = startOnboardingAttempt({ hasAttachment: false, track: trackEvent });

    handOffGoal({
      attemptId: attempt.id,
      goal,
      outcome: sendHomeGoal({ attempt, goal, language: locale }),
    });

    router.push("/start");
  };
}
