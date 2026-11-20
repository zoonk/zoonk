"use client";

import { type MockAnswer, type MockAnswerInput } from "@zoonk/core/exams/mocks/answer-contract";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { settleWithin } from "@zoonk/utils/timeout";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { type DraftSaveStatus, createDraftSaveQueue } from "./draft-save-queue";
import {
  clearUnsentMockDrafts,
  combinePendingMockDrafts,
  readUnsentMockDrafts,
  selectKeptDraftsForView,
  writeUnsentMockDrafts,
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
  blockId,
  draftsRef,
  initialView,
  onPendingChange,
  onRestore,
  queue,
  textTimer,
}: {
  blockId: string;
  draftsRef: React.RefObject<Drafts>;
  initialView: MockView;
  onPendingChange: (pending: MockDraft[]) => void;
  onRestore: (drafts: Drafts) => void;
  queue: DraftQueue;
  textTimer: React.RefObject<ReturnType<typeof setTimeout> | null>;
}) {
  const initialViewRef = useRef(initialView);
  const handlePendingChange = useEffectEvent(onPendingChange);
  const handleRestore = useEffectEvent(onRestore);

  useEffect(() => {
    const view = initialViewRef.current;
    queue.start();
    queue.setPendingListener(handlePendingChange);

    if (view.status === "finished" || view.status === "expired") {
      clearUnsentMockDrafts(blockId);
    } else if (view.status === "running") {
      const kept = readUnsentMockDrafts(blockId);
      const keptHere = selectKeptDraftsForView({ kept, view });

      if (kept.length !== keptHere.length) {
        writeUnsentMockDrafts({ blockId, drafts: keptHere });
      }

      if (keptHere.length > 0) {
        const merged = {
          ...draftsRef.current,
          ...Object.fromEntries(keptHere.map((draft) => [draft.itemId, draft])),
        };

        draftsRef.current = merged;
        handleRestore(merged);

        for (const draft of keptHere) {
          queue.add(draft);
        }
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
      queue.setPendingListener(undefined);
      queue.stop();
    };
  }, [blockId, draftsRef, queue, textTimer]);
}

export function useMockDrafts({
  save,
  view,
}: {
  save: (input: MockAnswerInput) => Promise<boolean>;
  view: MockView;
}) {
  const { blockId } = view;
  const [drafts, setDrafts] = useState<Drafts>(() => toDrafts(view));
  const [failedDrafts, setFailedDrafts] = useState<Partial<Drafts>>({});
  const [savedDrafts, setSavedDrafts] = useState<Drafts>(drafts);
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>("saved");
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
        onStatus: setSaveStatus,
        onStored: (draft) => {
          setSavedDrafts((current) => ({ ...current, [draft.itemId]: draft }));

          setFailedDrafts((current) =>
            current[draft.itemId] ? { ...current, [draft.itemId]: undefined } : current,
          );
        },
        save,
      }),
    [save],
  );

  function keepOnDevice(pending: readonly MockDraft[] = queue.pending()) {
    writeUnsentMockDrafts({
      blockId,
      drafts: combinePendingMockDrafts({ pending, unsavedText: unsavedText.current }),
    });
  }

  useUnsentDraftSync({
    blockId,
    draftsRef,
    initialView: view,
    onPendingChange: keepOnDevice,
    onRestore: setDrafts,
    queue,
    textTimer,
  });

  function persist(draft: MockDraft) {
    draftsRef.current = { ...draftsRef.current, [draft.itemId]: draft };
    setDrafts(draftsRef.current);
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
      const nextDrafts = toDrafts(next);
      draftsRef.current = nextDrafts;
      setDrafts(nextDrafts);
      setFailedDrafts({});
      setSavedDrafts(nextDrafts);
      clearUnsentMockDrafts(blockId);
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
      keepOnDevice();

      if (textTimer.current) {
        clearTimeout(textTimer.current);
      }

      textTimer.current = setTimeout(saveText, TEXT_SAVE_DELAY_MS);
    },
  };
}
