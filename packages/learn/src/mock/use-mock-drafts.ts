"use client";

import { type MockAnswer, type MockAnswerInput } from "@zoonk/core/exams/mocks/answer-contract";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { settleWithin } from "@zoonk/utils/timeout";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { type DraftSaveStatus, createDraftSaveQueue } from "./draft-save-queue";
import {
  type PendingMockDraft,
  clearHandedInMockDrafts,
  dropUnsentMockDraft,
  keepUnsentMockDraft,
  restoreUnsentMockDrafts,
} from "./unsent-drafts";

type Drafts = Record<string, PendingMockDraft>;

const TEXT_SAVE_DELAY_MS = 1500;

/** Leaving waits at most this long for answers going out, so ✕ always leaves, even offline. */
const LEAVE_WAIT_MS = 5000;

function toDrafts(view: MockView): Drafts {
  return Object.fromEntries((view.current?.drafts ?? []).map((draft) => [draft.itemId, draft]));
}

function withoutDraft(drafts: Partial<Drafts>, itemId: string): Partial<Drafts> {
  return drafts[itemId] ? { ...drafts, [itemId]: undefined } : drafts;
}

function emptyDraft(itemId: string): MockDraft {
  return { answer: null, durationMs: 0, flagged: false, itemId };
}

function nextEdit(draft: PendingMockDraft): PendingMockDraft {
  const edit = draft.edit;

  return {
    ...draft,
    edit: edit
      ? { ...edit, order: edit.order + 1 }
      : { base: draft.revision, order: 0, writer: crypto.randomUUID() },
  };
}

function readKept({ blockId, view }: { blockId: string; view: MockView }): PendingMockDraft[] {
  return restoreUnsentMockDrafts({ blockId, view }).map((draft) => {
    if (draft.edit) {
      return draft;
    }

    const stamped = nextEdit(draft);
    keepUnsentMockDraft({ blockId, draft: stamped, keepPlace: true });
    return stamped;
  });
}

export function useMockDrafts({
  onEnter,
  save,
  view,
}: {
  /** The answers this device kept for a view it enters, on mount and after each step. */
  onEnter: (view: MockView, kept: MockDraft[]) => void;
  save: (input: MockAnswerInput) => Promise<boolean | null>;
  view: MockView;
}) {
  const { blockId } = view;
  const [drafts, setDrafts] = useState<Drafts>(() => toDrafts(view));
  const [failedDrafts, setFailedDrafts] = useState<Partial<Drafts>>({});
  const [savedDrafts, setSavedDrafts] = useState<Drafts>(drafts);
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>("saved");
  // Read by the first question's visit, which runs right after the restore and before it renders.
  const latestDrafts = useRef(drafts);
  const entered = useRef(false);
  const shown = useRef<{ at: number; itemId: string } | null>(null);
  const unsavedText = useRef<PendingMockDraft | null>(null);
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The host keeps `save` stable.
  const queue = useMemo(
    () =>
      createDraftSaveQueue<PendingMockDraft>({
        keyOf: (draft) => draft.itemId,
        onFailed: (draft) => setFailedDrafts((current) => ({ ...current, [draft.itemId]: draft })),
        onRefused: (draft) => dropUnsentMockDraft({ blockId, draft }),
        onStatus: setSaveStatus,
        onStored: (draft) => {
          dropUnsentMockDraft({ blockId, draft });
          setSavedDrafts((current) => ({ ...current, [draft.itemId]: draft }));
          setFailedDrafts((current) => withoutDraft(current, draft.itemId));
        },
        save: ({ answer, durationMs, edit, flagged, itemId }) =>
          save({ answer, durationMs, edit, flagged, itemId }),
      }),
    [blockId, save],
  );

  function setAllDrafts(next: Drafts) {
    latestDrafts.current = next;
    setDrafts(next);
  }

  function enter(next: MockView) {
    const kept = readKept({ blockId, view: next });
    const stored = toDrafts(next);

    setAllDrafts({ ...stored, ...Object.fromEntries(kept.map((draft) => [draft.itemId, draft])) });
    setSavedDrafts(stored);
    setFailedDrafts({});
    kept.forEach((draft) => queue.add(draft));
    onEnter(next, kept);
  }

  // Back and forward show this screen again as it was, so only what's still unsent goes out again.
  const enterOnMount = useEffectEvent(() => {
    if (entered.current) {
      readKept({ blockId, view }).forEach((draft) => queue.add(draft));
    } else {
      entered.current = true;
      enter(view);
    }
  });

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Device storage can be read only after hydration.
    enterOnMount();
    const retry = () => queue.retryNow();
    globalThis.addEventListener("online", retry);

    return () => {
      clearTimeout(textTimer.current ?? undefined);
      globalThis.removeEventListener("online", retry);
      queue.stop();
    };
  }, [queue]);

  function persist(draft: PendingMockDraft) {
    setAllDrafts({ ...latestDrafts.current, [draft.itemId]: draft });
    keepUnsentMockDraft({ blockId, draft, keepPlace: queue.isWaiting(draft.itemId) });
    queue.add(draft);
  }

  function saveText() {
    clearTimeout(textTimer.current ?? undefined);
    textTimer.current = null;
    const draft = unsavedText.current;
    unsavedText.current = null;

    if (draft) {
      persist(draft);
    }
  }

  function withTimeSpent(itemId: string): MockDraft {
    const draft = latestDrafts.current[itemId] ?? emptyDraft(itemId);
    const since = shown.current?.itemId === itemId ? shown.current.at : null;
    const now = Date.now();

    shown.current = { at: now, itemId };
    return since === null ? draft : { ...draft, durationMs: draft.durationMs + (now - since) };
  }

  return {
    answer: (itemId: string, answer: MockAnswer | null) =>
      persist(nextEdit({ ...withTimeSpent(itemId), answer })),
    drafts,
    failedDrafts,
    flush: () => {
      saveText();
      return queue.flush();
    },
    inFlight: () => {
      saveText();

      if (!queue.isBusy()) {
        return null;
      }

      queue.retryNow();
      return settleWithin({ ms: LEAVE_WAIT_MS, request: () => queue.idle() });
    },
    leave: (itemId: string, countTime = true) => {
      if (shown.current?.itemId === itemId) {
        const shouldSave = unsavedText.current !== null || (countTime && !queue.wasRefused(itemId));
        unsavedText.current = null;

        if (shouldSave) {
          persist(nextEdit(withTimeSpent(itemId)));
        }

        shown.current = null;
      }
    },
    reset: (next: MockView) => {
      shown.current = null;
      clearHandedInMockDrafts({ blockId, next, previous: view });
      queue.forgetRefusals();
      enter(next);
    },
    retry: () => queue.retryNow(),
    saveStatus,
    savedDrafts,
    show: (itemId: string) => {
      shown.current = { at: Date.now(), itemId };
    },
    toggleUnsure: (itemId: string) => {
      unsavedText.current = null;
      const draft = withTimeSpent(itemId);
      persist(nextEdit({ ...draft, flagged: !draft.flagged }));
    },
    visit: (itemId: string) => {
      if (!latestDrafts.current[itemId]) {
        persist(nextEdit(emptyDraft(itemId)));
      }
    },
    write: (itemId: string, answer: MockAnswer | null) => {
      const draft = nextEdit({ ...(latestDrafts.current[itemId] ?? emptyDraft(itemId)), answer });

      setAllDrafts({ ...latestDrafts.current, [itemId]: draft });
      unsavedText.current = draft;
      keepUnsentMockDraft({ blockId, draft, keepPlace: queue.isWaiting(draft.itemId) });

      if (textTimer.current) {
        clearTimeout(textTimer.current);
      }

      textTimer.current = setTimeout(saveText, TEXT_SAVE_DELAY_MS);
    },
  };
}
