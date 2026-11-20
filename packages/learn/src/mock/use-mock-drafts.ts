"use client";

import { type MockAnswer, type MockAnswerInput } from "@zoonk/core/exams/mocks/answer-contract";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { settleWithin } from "@zoonk/utils/timeout";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  type DraftSaveOutcome,
  type DraftSaveStatus,
  createDraftSaveQueue,
} from "./draft-save-queue";
import {
  dropUnsentMockDraft,
  getForwardOnlyKeptReached,
  keepUnsentMockDraft,
  pruneUnsentMockDrafts,
} from "./unsent-drafts";

type Drafts = Record<string, MockDraft>;
type DraftQueue = ReturnType<typeof createDraftSaveQueue<MockDraft>>;

const TEXT_SAVE_DELAY_MS = 1500;

/** Leaving waits at most this long for answers going out, so ✕ always leaves, even offline. */
const LEAVE_WAIT_MS = 5000;

function toDrafts(view: MockView): Drafts {
  return Object.fromEntries((view.current?.drafts ?? []).map((draft) => [draft.itemId, draft]));
}

function emptyDraft(itemId: string): MockDraft {
  return { answer: null, durationMs: 0, flagged: false, itemId };
}

function useUnsentDraftSync({
  activeViewRef,
  blockId,
  draftsRef,
  onRestore,
  queue,
  savedDrafts,
  textTimer,
}: {
  activeViewRef: React.RefObject<MockView>;
  blockId: string;
  draftsRef: React.RefObject<Drafts>;
  onRestore: (merged: Drafts, keptReached: number) => void;
  queue: DraftQueue;
  savedDrafts: Drafts;
  textTimer: React.RefObject<ReturnType<typeof setTimeout> | null>;
}) {
  const handleRestore = useEffectEvent(onRestore);
  const readSavedDrafts = useEffectEvent(() => savedDrafts);

  useEffect(() => {
    const view = activeViewRef.current;
    queue.start();

    const keptHere = pruneUnsentMockDrafts({ blockId, storedDrafts: readSavedDrafts(), view });

    if (keptHere.length > 0) {
      const merged = {
        ...draftsRef.current,
        ...Object.fromEntries(keptHere.map((draft) => [draft.itemId, draft])),
      };

      draftsRef.current = merged;
      handleRestore(merged, getForwardOnlyKeptReached({ kept: keptHere, view }));

      for (const draft of keptHere) {
        queue.add(draft);
      }
    }

    const retry = () => queue.retryNow();
    globalThis.addEventListener("online", retry);

    return () => {
      if (textTimer.current) {
        clearTimeout(textTimer.current);
        textTimer.current = null;
      }

      globalThis.removeEventListener("online", retry);
      queue.stop();
    };
  }, [activeViewRef, blockId, draftsRef, queue, textTimer]);
}

export function useMockDrafts({
  onRestoreReached,
  save,
  view,
}: {
  onRestoreReached?: (reached: number) => void;
  save: (input: MockAnswerInput) => Promise<DraftSaveOutcome>;
  view: MockView;
}) {
  const { blockId } = view;
  const [drafts, setDrafts] = useState<Drafts>(() => toDrafts(view));
  const [failedDrafts, setFailedDrafts] = useState<Partial<Drafts>>({});
  const [savedDrafts, setSavedDrafts] = useState<Drafts>(drafts);
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>("saved");
  const activeViewRef = useRef(view);
  const draftsRef = useRef<Drafts>(drafts);
  const shown = useRef<{ at: number; itemId: string } | null>(null);
  const unsavedText = useRef<MockDraft | null>(null);
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The host keeps `save` stable.
  const queue = useMemo(
    () =>
      createDraftSaveQueue<MockDraft>({
        keyOf: (draft) => draft.itemId,
        onFailed: (draft) => setFailedDrafts((current) => ({ ...current, [draft.itemId]: draft })),
        onRefused: (draft) => dropUnsentMockDraft({ blockId, draft }),
        onStatus: setSaveStatus,
        onStored: (draft) => {
          dropUnsentMockDraft({ blockId, draft });
          setSavedDrafts((current) => ({ ...current, [draft.itemId]: draft }));

          setFailedDrafts((current) =>
            current[draft.itemId] ? { ...current, [draft.itemId]: undefined } : current,
          );
        },
        save,
      }),
    [blockId, save],
  );

  useUnsentDraftSync({
    activeViewRef,
    blockId,
    draftsRef,
    onRestore: (merged, keptReached) => {
      setDrafts(merged);

      if (keptReached >= 0) {
        onRestoreReached?.(keptReached);
      }
    },
    queue,
    savedDrafts,
    textTimer,
  });

  function persist(draft: MockDraft) {
    draftsRef.current = { ...draftsRef.current, [draft.itemId]: draft };
    setDrafts(draftsRef.current);
    keepUnsentMockDraft({ blockId, draft });
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
    const draft = draftsRef.current[itemId] ?? emptyDraft(itemId);
    const since = shown.current?.itemId === itemId ? shown.current.at : null;
    const now = Date.now();

    shown.current = { at: now, itemId };
    return since === null ? draft : { ...draft, durationMs: draft.durationMs + (now - since) };
  }

  return {
    answer: (itemId: string, answer: MockAnswer | null) =>
      persist({ ...withTimeSpent(itemId), answer }),
    drafts,
    failedDrafts,
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
      if (textTimer.current) {
        clearTimeout(textTimer.current);
        textTimer.current = null;
      }

      unsavedText.current = null;
      shown.current = null;
      activeViewRef.current = next;
      const nextDrafts = toDrafts(next);
      draftsRef.current = nextDrafts;
      setDrafts(nextDrafts);
      setFailedDrafts({});
      setSavedDrafts(nextDrafts);
      pruneUnsentMockDrafts({ blockId, storedDrafts: nextDrafts, view: next });
      queue.forgetRefusals();
    },
    retry: () => queue.retryNow(),
    saveStatus,
    savedDrafts,
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
      if (!draftsRef.current[itemId]) {
        persist(emptyDraft(itemId));
      }
    },
    write: (itemId: string, answer: MockAnswer | null) => {
      const draft = { ...(draftsRef.current[itemId] ?? emptyDraft(itemId)), answer };

      draftsRef.current = { ...draftsRef.current, [itemId]: draft };
      setDrafts(draftsRef.current);
      unsavedText.current = draft;
      keepUnsentMockDraft({ blockId, draft });

      if (textTimer.current) {
        clearTimeout(textTimer.current);
      }

      textTimer.current = setTimeout(saveText, TEXT_SAVE_DELAY_MS);
    },
  };
}
