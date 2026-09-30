"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import {
  type OnboardingDraftEdit,
  type OnboardingDraftView,
} from "@zoonk/core/view-models/onboarding/contract";
import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";
import { type UnderstandingActions } from "../onboarding-actions";

/**
 * What the learner can do with a draft on screen: load it once its words were read, start the read
 * again ("Try again"), and fix one fact on the card. Each hands the new draft to `onDraft`.
 */
export function useDraftActions({
  draft,
  onDraft,
  understanding,
}: {
  draft: OnboardingDraftView | null;
  onDraft: (draft: OnboardingDraftView) => void;
  understanding: UnderstandingActions;
}) {
  const [readFailed, setReadFailed] = useState(false);
  /** Starting the read again hit the day's limit. */
  const [limit, setLimit] = useState<EntitlementTier | null>(null);
  const [isRetrying, startRetrying] = useTransition();

  /** The run said the words were read: load what was understood. */
  const loadRead = async () => {
    if (!draft) {
      return;
    }

    const { data: next } = await safeAsync(() => understanding.get(draft.id));
    setReadFailed(!next);

    if (next) {
      onDraft(next);
    }
  };

  /** "Try again" on a read that failed or didn't start: a new run, followed from the start. */
  const retry = () => {
    if (!draft) {
      return;
    }

    startRetrying(async () => {
      const { data: outcome } = await safeAsync(() => understanding.retry(draft.id));

      if (outcome?.status === "limitReached") {
        setLimit(outcome.tier);
        return;
      }

      if (outcome?.status === "started" || outcome?.status === "startFailed") {
        setReadFailed(false);
        onDraft(outcome.draft);
      }
    });
  };

  /** The follower's own "Try again": the new run's id, followed in place. */
  const restart = async (): Promise<string | null> => {
    if (!draft) {
      return null;
    }

    const outcome = await understanding.retry(draft.id);

    if (outcome.status === "limitReached") {
      setLimit(outcome.tier);
    }

    if (outcome.status !== "started") {
      throw new Error("The read couldn't start again");
    }

    if (outcome.draft.status !== "understanding") {
      onDraft(outcome.draft);
    }

    return outcome.draft.generationId;
  };

  /** One fix on the card; false when it couldn't be saved. */
  const revise = async (edit: OnboardingDraftEdit): Promise<boolean> => {
    if (!draft) {
      return false;
    }

    const { data: next } = await safeAsync(() => understanding.revise({ draftId: draft.id, edit }));

    if (next) {
      onDraft(next);
    }

    return Boolean(next);
  };

  return { isRetrying, limit, loadRead, readFailed, restart, retry, revise };
}
