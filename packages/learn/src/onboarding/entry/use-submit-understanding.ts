"use client";

import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useLearnAnalytics } from "../../learn-context";
import { type GoalError, useStartError } from "../goal-errors";
import { type UnderstandingActions } from "../onboarding-actions";
import { getClassifiedKind, sendGoal } from "./understanding-start";

/** The continuation belongs to the submit handler, and is cancelled on leaving or changing goals. */
export function useSubmitUnderstanding({
  hasAttachment,
  onDraft,
  onError,
  onExplanation,
  onSending,
  understanding,
}: {
  hasAttachment: boolean;
  onDraft: (draft: OnboardingDraftView) => void;
  onError: (input: { error: GoalError; words: string }) => void;
  onExplanation: (input: { draft: OnboardingDraftView; question: string }) => void;
  onSending: (goal: string) => void;
  understanding: UnderstandingActions;
}) {
  const locale = useLocale();
  const analytics = useLearnAnalytics();
  const toError = useStartError();
  const submitted = useRef<AbortController | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => () => submitted.current?.abort(), []);

  function cancel() {
    submitted.current?.abort();
    submitted.current = null;
    setIsSubmitting(false);
  }

  /**
   * One goal on its way at a time: another send while it is (two taps the page replays once its
   * code has arrived) would save a second draft. Cancelling, or the send ending, lets the next go.
   */
  async function send(goal: string) {
    if (submitted.current) {
      return;
    }

    const controller = new AbortController();
    submitted.current = controller;

    try {
      await sendOnce({ goal, signal: controller.signal });
    } finally {
      if (submitted.current === controller) {
        submitted.current = null;
      }
    }
  }

  async function sendOnce({ goal, signal }: { goal: string; signal: AbortSignal }) {
    setIsSubmitting(true);
    const sentAt = Date.now();
    analytics.track({ name: "Goal Typed", properties: { has_attachment: hasAttachment } });
    onSending(goal);

    const outcome = await sendGoal({ goal, language: locale, onDraft, signal, understanding });

    if (signal.aborted) {
      return;
    }

    setIsSubmitting(false);

    if (outcome.status !== "started" && outcome.status !== "startFailed") {
      onError({ error: toError(outcome), words: goal });
      return;
    }

    onDraft(outcome.draft);
    const read = outcome.draft.status === "understood" ? outcome.draft.understanding : null;

    if (!read) {
      return;
    }

    analytics.track({
      name: "Goal Classified",
      properties: {
        duration_ms: Math.max(0, Date.now() - sentAt),
        result: getClassifiedKind(read),
      },
    });

    if (read.status === "explain") {
      onExplanation({ draft: outcome.draft, question: read.question });
    }
  }

  return { cancel, isSubmitting, send };
}
