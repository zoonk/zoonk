"use client";

import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { useEffect, useRef, useState } from "react";
import { useAppLocale } from "../../_utils/locale";
import { useLearnAnalytics } from "../../learn-context";
import { type GoalError, useStartError } from "../goal-errors";
import { type StartUnderstandingOutcome, type UnderstandingActions } from "../onboarding-actions";
import { startOnboardingAttempt } from "./attempt-clock";
import { forgetSentGoal, holdSentGoal, sendGoal, takeSentGoal } from "./understanding-start";

export function useSubmitUnderstanding({
  draftId,
  hasAttachment,
  onDraft,
  onError,
  onExplanation,
  onSending,
  understanding,
}: {
  draftId: string | null;
  hasAttachment: boolean;
  onDraft: (draft: OnboardingDraftView) => void;
  onError: (input: { error: GoalError; words: string }) => void;
  onExplanation: (input: { draft: OnboardingDraftView; question: string }) => void;
  onSending: (sent: { attemptId?: string; goal: string; sentAt: number }) => void;
  understanding: UnderstandingActions;
}) {
  const locale = useAppLocale();
  const analytics = useLearnAnalytics();
  const toError = useStartError();
  const submitted = useRef<AbortController | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => () => submitted.current?.abort(), []);

  useEffect(() => (draftId ? holdSentGoal(draftId) : undefined), [draftId]);

  function cancel() {
    if (draftId) {
      forgetSentGoal(draftId);
    }

    submitted.current?.abort();
    submitted.current = null;
    setIsSubmitting(false);
  }

  /**
   * One goal on its way at a time: taps replayed once the page's code arrived would otherwise save
   * a second draft.
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
    const attempt = startOnboardingAttempt({ hasAttachment, track: analytics.track });
    const sentAt = attempt.submittedAt;
    const outcome = sendGoal({ attempt, goal, language: locale, signal, understanding });
    await follow({ attemptId: attempt.id, goal, outcome, sentAt, signal });
  }

  /** Shows the goal on its way, then what was understood or what went wrong, unless `signal` aborted. */
  async function follow({
    attemptId,
    goal,
    outcome,
    sentAt,
    signal,
  }: {
    goal: string;
    attemptId?: string;
    outcome: Promise<StartUnderstandingOutcome>;
    sentAt: number;
    signal: AbortSignal;
  }) {
    setIsSubmitting(true);
    onSending({ attemptId, goal, sentAt });

    const result = await outcome;

    if (signal.aborted) {
      return;
    }

    setIsSubmitting(false);

    if (result.status !== "started" && result.status !== "startFailed") {
      onError({ error: toError(result), words: goal });
      return;
    }

    onDraft(result.draft);
  }

  function settle(draft: OnboardingDraftView) {
    const read = draft.status === "understood" ? draft.understanding : null;
    const sentAt = read ? takeSentGoal(draft.id) : null;

    if (!read || sentAt === null) {
      return;
    }

    if (read.status === "explain") {
      onExplanation({ draft, question: read.question });
    }
  }

  return { cancel, follow, isSubmitting, send, settle };
}
