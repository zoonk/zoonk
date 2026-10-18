"use client";

import { getDraftHref } from "@/app/[lang]/(app)/(onboarding)/start/start-params";
import { useRouter } from "@/i18n/navigation";
import { trackEvent } from "@zoonk/core/analytics/client";
import { type GoalError, useStartError } from "@zoonk/learn/onboarding/goal-errors";
import { safeAsync } from "@zoonk/utils/error";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";

/**
 * Sends a typed goal, then opens its draft, where `/start` waits for it to be read and carries the
 * click on. A question read at once (stored from someone's earlier words) starts its explanation
 * from that click instead. Loaded on the first tap, so the page doesn't ship the account and
 * actions code to visitors who only read it.
 */
async function sendHomeGoal({
  goal,
  language,
  signal,
}: {
  goal: string;
  language: string;
  signal: AbortSignal;
}) {
  const [
    { WEB_ONBOARDING_ACTIONS },
    { getClassifiedKind, getExplanationGoalInput, sendGoal, takeSentGoal },
  ] = await Promise.all([
    import("@/app/[lang]/(app)/(onboarding)/start/onboarding-client-actions"),
    import("@zoonk/learn/onboarding/understanding-start"),
  ]);

  const outcome = await sendGoal({
    goal,
    language,
    signal,
    understanding: WEB_ONBOARDING_ACTIONS.understanding,
  });

  if (signal.aborted || outcome.status !== "started" || outcome.draft.status !== "understood") {
    return { explanationId: null, outcome };
  }

  // Read at once: this click goes on here, so `/start` doesn't carry it on again.
  const sentAt = takeSentGoal(outcome.draft.id) ?? Date.now();
  const { understanding } = outcome.draft;

  if (!understanding) {
    return { explanationId: null, outcome };
  }

  trackEvent({
    name: "Goal Classified",
    properties: {
      duration_ms: Math.max(0, Date.now() - sentAt),
      result: getClassifiedKind(understanding),
    },
  });

  if (understanding.status !== "explain") {
    return { explanationId: null, outcome };
  }

  const question = understanding.question;

  const { data: explanation } = await safeAsync(() =>
    WEB_ONBOARDING_ACTIONS.createGoals(
      getExplanationGoalInput({ draft: outcome.draft, language, question }),
    ),
  );

  return { explanationId: explanation?.status === "created" ? explanation.goalId : null, outcome };
}

/** The home page's way into onboarding: the typed goal is saved, then `/start` opens on its wait. */
export function useSendGoal() {
  const locale = useLocale();
  const router = useRouter();
  const toError = useStartError();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<GoalError | null>(null);
  const submitted = useRef<AbortController | null>(null);

  // Leaving the page ends its send: the router may keep the page and show it again on the way
  // back, with the visitor's words still in the box and the box free to send again.
  useEffect(
    () => () => {
      submitted.current?.abort();
      setSending(false);
    },
    [],
  );

  const send = async (goal: string) => {
    submitted.current?.abort();
    const controller = new AbortController();
    submitted.current = controller;
    setError(null);
    setSending(true);
    trackEvent({ name: "Goal Typed", properties: { has_attachment: false } });

    const { explanationId, outcome } = await sendHomeGoal({
      goal,
      language: locale,
      signal: controller.signal,
    });

    if (controller.signal.aborted) {
      return;
    }

    if (explanationId) {
      router.push(`/explain/${explanationId}`);
      return;
    }

    if (outcome.status === "started" || outcome.status === "startFailed") {
      router.push(getDraftHref(outcome.draft.id));
      return;
    }

    setSending(false);
    setError(toError(outcome));
  };

  return { error, send, sending };
}
