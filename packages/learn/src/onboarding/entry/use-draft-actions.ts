"use client";

import {
  type OnboardingDraftEdit,
  type OnboardingDraftView,
} from "@zoonk/core/view-models/onboarding/contract";
import { safeAsync } from "@zoonk/utils/error";
import { useEffect, useRef, useState, useTransition } from "react";
import { type GoalError, useStartError } from "../goal-errors";
import { type StartUnderstandingOutcome, type UnderstandingActions } from "../onboarding-actions";

function isLimit(
  outcome: StartUnderstandingOutcome | null,
): outcome is Extract<
  StartUnderstandingOutcome,
  { status: "limitReached" | "needsAccount" | "signUpRequired" }
> {
  return (
    outcome?.status === "limitReached" ||
    outcome?.status === "needsAccount" ||
    outcome?.status === "signUpRequired"
  );
}

export function useDraftActions({
  draft,
  onDraft,
  understanding,
}: {
  draft: OnboardingDraftView | null;
  onDraft: (draft: OnboardingDraftView) => void;
  understanding: UnderstandingActions;
}) {
  const toError = useStartError();
  const [readFailed, setReadFailed] = useState(false);
  const [limit, setLimit] = useState<GoalError | null>(null);
  const [isRetrying, startRetrying] = useTransition();
  const pending = useRef<AbortController | null>(null);
  const draftId = draft?.id;

  const cancel = () => pending.current?.abort();

  useEffect(() => {
    if (draftId) {
      return () => pending.current?.abort();
    }
  }, [draftId]);

  function beginRead() {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    return controller.signal;
  }

  const loadRead = async () => {
    if (!draft) {
      return;
    }

    const signal = beginRead();
    const { data: next } = await safeAsync(() => understanding.get(draft.id));

    if (signal.aborted) {
      return;
    }

    setReadFailed(!next);

    if (next) {
      onDraft(next);
    }
  };

  const retry = () => {
    if (!draft) {
      return;
    }

    startRetrying(async () => {
      const signal = beginRead();
      const { data: outcome } = await safeAsync(() => understanding.retry(draft.id));

      if (signal.aborted) {
        return;
      }

      if (isLimit(outcome)) {
        setLimit(toError(outcome));
        return;
      }

      if (outcome?.status === "started" || outcome?.status === "startFailed") {
        setReadFailed(false);
        onDraft(outcome.draft);
      }
    });
  };

  const restart = async (): Promise<string | null> => {
    if (!draft) {
      return null;
    }

    const signal = beginRead();
    const outcome = await understanding.retry(draft.id);

    if (signal.aborted) {
      return null;
    }

    if (isLimit(outcome)) {
      setLimit(toError(outcome));
    }

    if (outcome.status !== "started") {
      throw new Error("The read couldn't start again");
    }

    if (outcome.draft.status !== "understanding") {
      onDraft(outcome.draft);
    }

    return outcome.draft.generationId;
  };

  const revise = async (edit: OnboardingDraftEdit): Promise<boolean> => {
    if (!draft) {
      return false;
    }

    const signal = beginRead();
    const { data: next } = await safeAsync(() => understanding.revise({ draftId: draft.id, edit }));

    if (signal.aborted) {
      return false;
    }

    if (next) {
      onDraft(next);
    }

    return Boolean(next);
  };

  return { cancel, isRetrying, limit, loadRead, readFailed, restart, retry, revise };
}
