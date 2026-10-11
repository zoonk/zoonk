"use client";

import { type MockAnswer, type MockAnswerInput } from "@zoonk/core/exams/mocks/answer-contract";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { useRef, useState } from "react";

type Drafts = Record<string, MockDraft>;

/** Typing is saved this long after the learner stops, and whenever they leave the question. */
const TEXT_SAVE_DELAY_MS = 1500;

/** Whether a draft holds an answer: a pick, a number, or some text. */
export function isDraftAnswered(draft: MockDraft | undefined): boolean {
  const answer = draft?.answer ?? null;

  if (answer === null) {
    return false;
  }

  return "text" in answer ? answer.text.trim().length > 0 : true;
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
  const [failed, setFailed] = useState(false);
  const shown = useRef<{ at: number; itemId: string } | null>(null);
  // What was typed since its last save (an essay, a word, a number), saved once typing pauses.
  const unsavedText = useRef<MockDraft | null>(null);
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Saves go out one after another, so an older draft never lands after a newer one.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const inFlight = useRef(0);

  function persist(draft: MockDraft) {
    setDrafts((current) => ({ ...current, [draft.itemId]: draft }));
    inFlight.current += 1;

    queue.current = queue.current.then(async () => {
      try {
        setFailed(!(await save(draft)));
      } finally {
        inFlight.current -= 1;
      }
    });
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
    failed,
    /** Waits for every save, so handing a section in never loses the last answer. */
    flush: () => {
      saveText();
      return queue.current;
    },
    /** The saves still going out, which leaving waits for; null when none is. */
    inFlight: () => {
      saveText();
      return inFlight.current > 0 ? queue.current : null;
    },
    /** A question leaves the screen: its time so far (and what was typed) is saved with it. */
    leave: (itemId: string) => {
      if (shown.current?.itemId === itemId) {
        unsavedText.current = null;
        saveText();
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
