"use client";

import { MAX_WRITING_MS } from "@zoonk/core/exams/essays/contract";
import {
  MAX_OBJECTIVE_ANSWER_DURATION_MS,
  MOCK_ANSWER_DEADLINE_GRACE_MS,
  type MockAnswer,
  type MockAnswerInput,
} from "@zoonk/core/exams/mocks/answer-contract";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockDraft, type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";
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

function addQuestionTime({
  deadline,
  draft,
  questions,
  now,
  since,
}: {
  deadline: number;
  draft: MockDraft;
  questions: readonly MockQuestion[] | undefined;
  now: number;
  since: number | null;
}): MockDraft {
  if (since === null) {
    return draft;
  }

  const elapsed = Math.max(0, Math.min(now, deadline) - since);
  const question = questions?.find(({ itemId }) => itemId === draft.itemId);
  const limit = question?.format === "essay" ? MAX_WRITING_MS : MAX_OBJECTIVE_ANSWER_DURATION_MS;
  return { ...draft, durationMs: Math.min(limit, draft.durationMs + elapsed) };
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

function useQueueLifecycle({
  enter,
  queue,
  replay,
  stopText,
}: {
  enter: () => void;
  queue: ReturnType<typeof createDraftSaveQueue<PendingMockDraft>>;
  replay: () => void;
  stopText: () => void;
}) {
  const entered = useRef(false);

  const enterOnMount = useEffectEvent(() => {
    if (entered.current) {
      replay();
    } else {
      entered.current = true;
      enter();
    }
  });

  const stopOnUnmount = useEffectEvent(stopText);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Device storage can be read only after hydration.
    enterOnMount();
    globalThis.addEventListener("online", queue.retryNow);

    return () => {
      stopOnUnmount();
      globalThis.removeEventListener("online", queue.retryNow);
      queue.stop();
    };
  }, [queue]);
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
  const deadline = view.current ? Date.parse(view.current.deadline) : Infinity;
  const [drafts, setDrafts] = useState<Drafts>(() => toDrafts(view));
  const [failedDrafts, setFailedDrafts] = useState<Partial<Drafts>>({});
  const [savedDrafts, setSavedDrafts] = useState<Drafts>(drafts);
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>("saved");
  // Read by the first question's visit, which runs right after the restore and before it renders.
  const latestDrafts = useRef(drafts);
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
  useQueueLifecycle({
    enter: () => enter(view),
    queue,
    replay: () => readKept({ blockId, view }).forEach((draft) => queue.add(draft)),
    stopText: () => clearTimeout(textTimer.current ?? undefined),
  });

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
    const before = shown.current;
    const now = Date.now();
    shown.current = { at: now, itemId };

    return addQuestionTime({
      deadline,
      draft,
      now,
      questions: view.current?.questions,
      since: before?.itemId === itemId ? before.at : null,
    });
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
    leave: (itemId: string) => {
      if (shown.current?.itemId === itemId) {
        const canSaveTime = Date.now() <= deadline + MOCK_ANSWER_DEADLINE_GRACE_MS;

        const shouldSave =
          unsavedText.current !== null || (canSaveTime && !queue.wasRefused(itemId));

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
