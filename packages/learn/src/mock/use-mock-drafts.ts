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
  type ForwardOnlyKeptRecovery,
  clearHandedInMockDrafts,
  dropUnsentMockDraft,
  getForwardOnlyKeptRecovery,
  keepUnsentMockDraft,
  restoreUnsentMockDrafts,
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

function clearTextTimer(timer: React.RefObject<ReturnType<typeof setTimeout> | null>) {
  if (timer.current) {
    clearTimeout(timer.current);
    timer.current = null;
  }
}

function restoreKeptForView({
  base,
  blockId,
  queue,
  storedDrafts,
  view,
}: {
  base: Drafts;
  blockId: string;
  queue: DraftQueue;
  storedDrafts: Drafts;
  view: MockView;
}) {
  const kept = restoreUnsentMockDrafts({ blockId, storedDrafts, view });

  for (const draft of kept) {
    queue.add(draft);
  }

  return {
    keptCount: kept.length,
    merged:
      kept.length > 0
        ? { ...base, ...Object.fromEntries(kept.map((draft) => [draft.itemId, draft])) }
        : base,
    recovery: getForwardOnlyKeptRecovery({ kept, view }),
  };
}

function useMockDraftQueue({
  blockId,
  save,
  setFailedDrafts,
  setSaveStatus,
  setSavedDrafts,
}: {
  blockId: string;
  save: (input: MockAnswerInput) => Promise<DraftSaveOutcome>;
  setFailedDrafts: React.Dispatch<React.SetStateAction<Partial<Drafts>>>;
  setSaveStatus: React.Dispatch<React.SetStateAction<DraftSaveStatus>>;
  setSavedDrafts: React.Dispatch<React.SetStateAction<Drafts>>;
}) {
  // The host keeps `save` stable.
  return useMemo(
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
    [blockId, save, setFailedDrafts, setSaveStatus, setSavedDrafts],
  );
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
  onRestore: (merged: Drafts, recovery: ForwardOnlyKeptRecovery) => void;
  queue: DraftQueue;
  savedDrafts: Drafts;
  textTimer: React.RefObject<ReturnType<typeof setTimeout> | null>;
}) {
  const handleRestore = useEffectEvent(onRestore);
  const readSavedDrafts = useEffectEvent(() => savedDrafts);

  useEffect(() => {
    const view = activeViewRef.current;
    queue.start();

    const { keptCount, merged, recovery } = restoreKeptForView({
      base: draftsRef.current,
      blockId,
      queue,
      storedDrafts: readSavedDrafts(),
      view,
    });

    if (keptCount > 0) {
      draftsRef.current = merged;
      handleRestore(merged, recovery);
    }

    const retry = () => queue.retryNow();
    globalThis.addEventListener("online", retry);

    return () => {
      clearTextTimer(textTimer);
      globalThis.removeEventListener("online", retry);
      queue.stop();
    };
  }, [activeViewRef, blockId, draftsRef, queue, textTimer]);
}

export function useMockDrafts({
  onRestoreRecovery,
  save,
  view,
}: {
  onRestoreRecovery?: (recovery: ForwardOnlyKeptRecovery) => void;
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

  const queue = useMockDraftQueue({
    blockId,
    save,
    setFailedDrafts,
    setSaveStatus,
    setSavedDrafts,
  });

  useUnsentDraftSync({
    activeViewRef,
    blockId,
    draftsRef,
    onRestore: (merged, recovery) => {
      setDrafts(merged);
      onRestoreRecovery?.(recovery);
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
    clearTextTimer(textTimer);
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
    reset: (next: MockView): ForwardOnlyKeptRecovery => {
      clearTextTimer(textTimer);
      const previous = activeViewRef.current;
      unsavedText.current = null;
      shown.current = null;
      activeViewRef.current = next;
      const serverDrafts = toDrafts(next);
      clearHandedInMockDrafts({ blockId, next, previous });
      queue.forgetRefusals();

      const { merged, recovery } = restoreKeptForView({
        base: serverDrafts,
        blockId,
        queue,
        storedDrafts: serverDrafts,
        view: next,
      });

      draftsRef.current = merged;
      setDrafts(merged);
      setFailedDrafts({});
      setSavedDrafts(serverDrafts);
      return recovery;
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
      clearTextTimer(textTimer);
      textTimer.current = setTimeout(saveText, TEXT_SAVE_DELAY_MS);
    },
  };
}
