"use client";

import { type MockAnswer, type MockAnswerInput } from "@zoonk/core/exams/mocks/answer-contract";
import { isMockAnswerPresent } from "@zoonk/core/exams/mocks/answer-presence";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { settleWithin } from "@zoonk/utils/timeout";
import { useEffect, useMemo, useRef, useState } from "react";
import { type DraftSaveStatus, createDraftSaveQueue } from "./draft-save-queue";

type Drafts = Record<string, MockDraft>;

/** Typing is saved this long after the learner stops, and whenever they leave the question. */
const TEXT_SAVE_DELAY_MS = 1500;

/**
 * Leaving waits this long at most for answers still going out, so ✕ always leaves, even with the
 * connection down (the bar already says what isn't saved).
 */
const LEAVE_WAIT_MS = 5000;

/** Whether a draft holds an answer: a pick, a number, or some text. */
export function isDraftAnswered(draft: MockDraft | undefined): boolean {
  return isMockAnswerPresent(draft?.answer);
}

function toDrafts(view: MockView): Drafts {
  return Object.fromEntries((view.current?.drafts ?? []).map((draft) => [draft.itemId, draft]));
}

function emptyDraft(itemId: string): MockDraft {
  return { answer: null, durationMs: 0, flagged: false, itemId };
}

/**
 * The answer sheet while a section runs: picks, flags and the time on each question, saved as
 * the learner goes. Time counts while a question is on screen, so the result can compare the
 * learner's pace with the exam's.
 */
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
  // What was typed since its last save (an essay, a word, a number), saved once typing pauses.
  const unsavedText = useRef<MockDraft | null>(null);
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Saves go out one after another and a failed one is tried again before the rest, so an older
  // draft never lands after a newer one and none is dropped. The host keeps `save` stable.
  const queue = useMemo(
    () =>
      createDraftSaveQueue<MockDraft>({
        keyOf: (draft) => draft.itemId,
        onStatus: setSaveStatus,
        save,
      }),
    [save],
  );

  // The connection coming back sends what's waiting at once instead of after the next wait.
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

  /** Adds the time since the question appeared to its draft. */
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
    /** Waits for every save, retries included, so handing a section in never loses an answer. */
    flush: () => {
      saveText();
      return queue.idle();
    },
    /**
     * The saves still going out, which leaving waits for (a moment at most, trying the waiting ones
     * again first); null when none is.
     */
    inFlight: () => {
      saveText();

      if (!queue.isBusy()) {
        return null;
      }

      queue.retryNow();
      return settleWithin({ ms: LEAVE_WAIT_MS, request: () => queue.idle() });
    },
    /** A question leaves the screen: its time so far (and what was typed) is saved with it. */
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
    /** Sends the answers waiting after a failed request now, from the bar's "Retry". */
    retry: () => queue.retryNow(),
    /** Where the answers' saves stand, for the bar to say so (see `DraftSaveStatus`). */
    saveStatus,
    /** A question appears: its clock starts. */
    show: (itemId: string) => {
      shown.current = { at: Date.now(), itemId };
    },
    toggleFlag: (itemId: string) => {
      unsavedText.current = null;
      saveText();
      const draft = withTimeSpent(itemId);
      persist({ ...draft, flagged: !draft.flagged });
    },
    /**
     * A question of a forward-only section appears: it's saved as reached right away, so the ones
     * before it stay behind the learner, even after a reload.
     */
    visit: (itemId: string) => {
      if (!drafts[itemId]) {
        persist(emptyDraft(itemId));
      }
    },
    /** What's typed so far: kept at once, saved once typing pauses. */
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
