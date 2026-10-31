"use client";

import { type MockAnswer, type MockAnswerInput } from "@zoonk/core/exams/mocks/answer-contract";
import { isMockAnswerPresent } from "@zoonk/core/exams/mocks/answer-presence";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { settleWithin } from "@zoonk/utils/timeout";
import { useEffect, useMemo, useRef, useState } from "react";
import { type DraftSaveStatus, createDraftSaveQueue } from "./draft-save-queue";

type Drafts = Record<string, MockDraft>;

const TEXT_SAVE_DELAY_MS = 1500;

/** Leaving waits at most this long for answers going out, so ✕ always leaves, even offline. */
const LEAVE_WAIT_MS = 5000;

export function isDraftAnswered(draft: MockDraft | undefined): boolean {
  return isMockAnswerPresent(draft?.answer);
}

function toDrafts(view: MockView): Drafts {
  return Object.fromEntries((view.current?.drafts ?? []).map((draft) => [draft.itemId, draft]));
}

function emptyDraft(itemId: string): MockDraft {
  return { answer: null, durationMs: 0, flagged: false, itemId };
}

export function useMockDrafts({
  save,
  view,
}: {
  save: (input: MockAnswerInput) => Promise<boolean>;
  view: MockView;
}) {
  const [drafts, setDrafts] = useState<Drafts>(() => toDrafts(view));
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>("saved");
  const shown = useRef<{ at: number; itemId: string } | null>(null);
  const unsavedText = useRef<MockDraft | null>(null);
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The host keeps `save` stable.
  const queue = useMemo(
    () =>
      createDraftSaveQueue<MockDraft>({
        keyOf: (draft) => draft.itemId,
        onStatus: setSaveStatus,
        save,
      }),
    [save],
  );

  useEffect(() => {
    const retry = () => queue.retryNow();
    globalThis.addEventListener("online", retry);
    return () => globalThis.removeEventListener("online", retry);
  }, [queue]);

  function persist(draft: MockDraft) {
    setDrafts((current) => ({ ...current, [draft.itemId]: draft }));
    queue.add(draft);
  }

  function saveText() {
    if (textTimer.current) {
      clearTimeout(textTimer.current);
      textTimer.current = null;
    }

    const draft = unsavedText.current;
    unsavedText.current = null;

    if (draft) {
      persist(draft);
    }
  }

  function withTimeSpent(itemId: string): MockDraft {
    const draft = drafts[itemId] ?? emptyDraft(itemId);
    const since = shown.current?.itemId === itemId ? shown.current.at : null;
    const now = Date.now();

    shown.current = { at: now, itemId };
    return since === null ? draft : { ...draft, durationMs: draft.durationMs + (now - since) };
  }

  return {
    answer: (itemId: string, answer: MockAnswer | null) =>
      persist({ ...withTimeSpent(itemId), answer }),
    drafts,
    flush: () => {
      saveText();
      return queue.idle();
    },
    inFlight: () => {
      saveText();

      if (!queue.isBusy()) {
        return null;
      }

      queue.retryNow();
      return settleWithin({ ms: LEAVE_WAIT_MS, request: () => queue.idle() });
    },
    leave: (itemId: string) => {
      if (shown.current?.itemId === itemId) {
        unsavedText.current = null;
        saveText();
        persist(withTimeSpent(itemId));
        shown.current = null;
      }
    },
    reset: (next: MockView) => {
      shown.current = null;
      setDrafts(toDrafts(next));
    },
    retry: () => queue.retryNow(),
    saveStatus,
    show: (itemId: string) => {
      shown.current = { at: Date.now(), itemId };
    },
    toggleFlag: (itemId: string) => {
      unsavedText.current = null;
      saveText();
      const draft = withTimeSpent(itemId);
      persist({ ...draft, flagged: !draft.flagged });
    },
    visit: (itemId: string) => {
      if (!drafts[itemId]) {
        persist(emptyDraft(itemId));
      }
    },
    write: (itemId: string, answer: MockAnswer | null) => {
      const draft = { ...(drafts[itemId] ?? emptyDraft(itemId)), answer };

      setDrafts((current) => ({ ...current, [itemId]: draft }));
      unsavedText.current = draft;

      if (textTimer.current) {
        clearTimeout(textTimer.current);
      }

      textTimer.current = setTimeout(saveText, TEXT_SAVE_DELAY_MS);
    },
  };
}
