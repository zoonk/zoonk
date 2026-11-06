"use client";

import { useRouter } from "@/i18n/navigation";
import { trackEvent } from "@zoonk/core/analytics/client";
import { useAppLocale } from "@zoonk/learn/locale";
import { type StartUnderstandingOutcome } from "@zoonk/learn/onboarding/actions";
import { handOffGoal, sendGoal } from "@zoonk/learn/onboarding/understanding-start";
import { safeAsync } from "@zoonk/utils/error";

/** Loaded on the first tap, so the page doesn't ship the account and actions code to visitors who only read. */
async function sendHomeGoal({
  goal,
  language,
}: {
  goal: string;
  language: string;
}): Promise<StartUnderstandingOutcome> {
  const { data: actions } = await safeAsync(
    () => import("@/app/[lang]/(app)/(onboarding)/start/understanding-client-actions"),
  );

  if (!actions) {
    return { status: "failed" };
  }

  return sendGoal({ goal, language, understanding: actions.WEB_UNDERSTANDING_ACTIONS });
}

/** `/start` opens at once and shows the goal on its way, then what was understood or what went wrong. */
export function useSendGoal() {
  const locale = useAppLocale();
  const router = useRouter();

  return (goal: string) => {
    trackEvent({ name: "Goal Typed", properties: { has_attachment: false } });
    handOffGoal({ goal, outcome: sendHomeGoal({ goal, language: locale }) });
    router.push("/start");
  };
}
