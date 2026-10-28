"use client";

import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useLearnAnalytics } from "../../learn-context";
import { type GoalError, useStartError } from "../goal-errors";
import { type UnderstandingActions } from "../onboarding-actions";
import {
  forgetSentGoal,
  getClassifiedKind,
  holdSentGoal,
  sendGoal,
  takeSentGoal,
} from "./understanding-start";

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
  onSending: (goal: string) => void;
  understanding: UnderstandingActions;
}) {
  const locale = useLocale();
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

  /** One goal on its way at a time: taps replayed once the page's code arrived would otherwise save a second draft. */
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
    analytics.track({ name: "Goal Typed", properties: { has_attachment: hasAttachment } });
    onSending(goal);

    const outcome = await sendGoal({ goal, language: locale, signal, understanding });

    if (signal.aborted) {
      return;
    }

    setIsSubmitting(false);

    if (outcome.status !== "started" && outcome.status !== "startFailed") {
      onError({ error: toError(outcome), words: goal });
      return;
    }

    onDraft(outcome.draft);
  }

  function settle(draft: OnboardingDraftView) {
    const read = draft.status === "understood" ? draft.understanding : null;
    const sentAt = read ? takeSentGoal(draft.id) : null;

    if (!read || sentAt === null) {
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
      onExplanation({ draft, question: read.question });
    }
  }

  return { cancel, isSubmitting, send, settle };
}
