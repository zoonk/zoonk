"use client";

import {
  type MockAnswerInput,
  type MockChoice,
  type MockDraft,
  type MockView,
} from "@zoonk/core/exams/mocks/contract";
import { useRef, useState } from "react";

type Drafts = Record<string, MockDraft>;

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
  const [failed, setFailed] = useState(false);
  const shown = useRef<{ at: number; itemId: string } | null>(null);

  // Saves go out one after another, so an older draft never lands after a newer one.
  const queue = useRef<Promise<void>>(Promise.resolve());

  function persist(draft: MockDraft) {
    setDrafts((current) => ({ ...current, [draft.itemId]: draft }));

    queue.current = queue.current.then(async () => {
      setFailed(!(await save(draft)));
    });
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
    answer: (itemId: string, choice: MockChoice | null) =>
      persist({ ...withTimeSpent(itemId), answer: choice }),
    drafts,
    failed,
    /** Waits for every save, so handing a section in never loses the last answer. */
    flush: () => queue.current,
    /** A question leaves the screen: its time so far is saved with it. */
    leave: (itemId: string) => {
      if (shown.current?.itemId === itemId) {
        persist(withTimeSpent(itemId));
      }
    },
    reset: (next: MockView) => {
      shown.current = null;
      setDrafts(toDrafts(next));
    },
    /** A question appears: its clock starts. */
    show: (itemId: string) => {
      shown.current = { at: Date.now(), itemId };
    },
    toggleFlag: (itemId: string) => {
      const draft = withTimeSpent(itemId);
      persist({ ...draft, flagged: !draft.flagged });
    },
  };
}
