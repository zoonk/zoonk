"use client";

import { getDraftHref } from "@/app/[lang]/start/start-params";
import { useRouter } from "@/i18n/navigation";
import { trackEvent } from "@zoonk/core/analytics/client";
import { type GoalError, useStartError } from "@zoonk/learn/onboarding/goal-errors";
import { useLocale } from "next-intl";
import { useState } from "react";

/**
 * Sends a goal to be read and opens `/start` on it. Loaded on the first tap, so the page doesn't
 * ship the account and actions code to visitors who only read it.
 */
async function sendHomeGoal({ goal, language }: { goal: string; language: string }) {
  const [{ WEB_UNDERSTANDING_ACTIONS }, { sendGoal }] = await Promise.all([
    import("@/app/[lang]/start/understanding-client-actions"),
    import("@zoonk/learn/onboarding/understanding-start"),
  ]);

  return sendGoal({ goal, language, understanding: WEB_UNDERSTANDING_ACTIONS });
}

/** The home page's way into onboarding: the typed goal is saved and read, then `/start` opens on it. */
export function useSendGoal() {
  const locale = useLocale();
  const router = useRouter();
  const toError = useStartError();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<GoalError | null>(null);

  const send = async (goal: string) => {
    setError(null);
    setSending(true);
    trackEvent({ name: "Goal Typed", properties: { has_attachment: false } });

    const outcome = await sendHomeGoal({ goal, language: locale });

    if (outcome.status === "started" || outcome.status === "startFailed") {
      // Stays busy until `/start` shows the wait.
      router.push(getDraftHref(outcome.draft.id));
      return;
    }

    setSending(false);
    setError(toError(outcome));
  };

  return { error, send, sending };
}
