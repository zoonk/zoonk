"use client";

import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { useEffect, useRef, useState } from "react";
import { useAppLocale } from "../../_utils/locale";
import { useLearnAnalytics } from "../../learn-context";
import { type GoalError, useStartError } from "../goal-errors";
import {
  type SentMaterial,
  type StartUnderstandingOutcome,
  type UnderstandingActions,
} from "../onboarding-actions";
import { startOnboardingAttempt } from "./attempt-clock";
import { forgetSentGoal, holdSentGoal, sendGoal, takeSentGoal } from "./understanding-start";

export function useSubmitUnderstanding({
  draftId,
  onDraft,
  onError,
  onExplanation,
  onMaterialUnavailable,
  onSending,
  understanding,
}: {
  draftId: string | null;
  onDraft: (draft: OnboardingDraftView) => void;
  onError: (input: { error: GoalError; words: string }) => void;
  onExplanation: (input: { draft: OnboardingDraftView; question: string }) => void;
  onMaterialUnavailable: (input: { sourceIds: string[]; words: string }) => void;
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
   * a second draft. `words` are what the learner typed, which a refusal gives back; the goal sent
   * is made from their material when they typed none.
   */
  async function send({
    goal,
    material,
    words = goal,
  }: {
    goal: string;
    material: SentMaterial;
    words?: string;
  }) {
    if (submitted.current) {
      return;
    }

    const controller = new AbortController();
    submitted.current = controller;

    try {
      await sendOnce({ goal, material, signal: controller.signal, words });
    } finally {
      if (submitted.current === controller) {
        submitted.current = null;
      }
    }
  }

  async function sendOnce({
    goal,
    material,
    signal,
    words,
  }: {
    goal: string;
    material: SentMaterial;
    signal: AbortSignal;
    words: string;
  }) {
    const hasAttachment = Boolean(material.sourceIds?.length);
    const attempt = startOnboardingAttempt({ hasAttachment, track: analytics.track });
    const sentAt = attempt.submittedAt;
    const outcome = sendGoal({ attempt, goal, language: locale, material, signal, understanding });
    await follow({ attemptId: attempt.id, goal, outcome, sentAt, signal, words });
  }

  /** Shows the goal on its way, then what was understood or what went wrong, unless `signal` aborted. */
  async function follow({
    attemptId,
    goal,
    outcome,
    sentAt,
    signal,
    words = goal,
  }: {
    goal: string;
    attemptId?: string;
    outcome: Promise<StartUnderstandingOutcome>;
    sentAt: number;
    signal: AbortSignal;
    words?: string;
  }) {
    setIsSubmitting(true);
    onSending({ attemptId, goal, sentAt });

    const result = await outcome;

    if (signal.aborted) {
      return;
    }

    setIsSubmitting(false);

    if (result.status === "materialUnavailable") {
      onMaterialUnavailable({ sourceIds: result.sourceIds, words });
      return;
    }

    if (result.status !== "started" && result.status !== "startFailed") {
      onError({ error: toError(result), words });
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
