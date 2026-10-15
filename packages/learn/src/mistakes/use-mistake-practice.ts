"use client";

import { useEffect, useEffectEvent, useReducer, useRef } from "react";
import { type ChoiceAnswer } from "../questions/choice-question";
import {
  type MistakePracticeAnswer,
  type MistakePracticeFeedback,
  type MistakePracticeSummary,
  type PracticeEntry,
  createPracticeState,
  practiceReducer,
} from "./mistake-practice-state";

const MS_PER_SECOND = 1000;
const NOT_SURE: ChoiceAnswer = { dontKnow: true };

/**
 * How the host grades and counts a run. Each answer comes with the run's earlier answers, so saving
 * it counts the run so far and a run left halfway still counts; `finish` counts the whole run once
 * more at the end or when the learner stops, and says what it earned.
 */
export type MistakePracticeActions = {
  answer: (answer: MistakePracticeAnswer) => Promise<MistakePracticeFeedback>;
  finish: (run: { answerIds: string[] }) => Promise<MistakePracticeSummary | null>;
};

/**
 * Runs "Practice mistakes": each mistake's drill question by question, graded on the server, with
 * the run counted toward today as each answer is saved and once more when it ends.
 */
export function useMistakePractice({
  actions,
  practice,
}: {
  actions: MistakePracticeActions;
  practice: PracticeEntry[];
}) {
  const [state, dispatch] = useReducer(practiceReducer, practice, createPracticeState);
  const { steps } = state;
  const step = steps[state.index];
  const shownAt = useRef(0);
  // The id the question on screen is saved under, however often its answer is sent.
  const attempt = useRef<{ id: string; index: number } | null>(null);

  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

  const finish = useEffectEvent(async () => {
    // A count that didn't get through still ends the run: each answer was counted as it came.
    const summary =
      state.answerIds.length === 0
        ? null
        : await actions.finish({ answerIds: state.answerIds }).catch(() => null);

    dispatch({ summary, type: "ended" });
  });

  useEffect(() => {
    if (state.phase.kind === "ending") {
      void finish();
    }
  }, [state.phase.kind]);

  const check = async ({ answer, timedOut }: { answer: ChoiceAnswer; timedOut: boolean }) => {
    if (!step) {
      return;
    }

    const limitMs = (step.entry.drill.timeLimitSeconds ?? 0) * MS_PER_SECOND;
    const durationMs = Date.now() - shownAt.current;

    dispatch({ answer, timedOut, type: "check" });

    if (attempt.current?.index !== state.index) {
      attempt.current = { id: crypto.randomUUID(), index: state.index };
    }

    // A request that didn't get through (the network dropped) reads as not saved, with the answer
    // kept to check again, never as a Check that spins forever.
    const feedback = await actions
      .answer({
        answer,
        attemptId: attempt.current.id,
        durationMs: timedOut ? Math.max(durationMs, limitMs) : durationMs,
        itemId: step.question.itemId,
        mistakeId: step.entry.mistakeId,
        runAnswerIds: state.answerIds,
      })
      .catch(() => null);

    if (!feedback) {
      dispatch({ type: "answerFailed" });
      return;
    }

    dispatch({ feedback, mistakeId: step.entry.mistakeId, type: "answered" });
  };

  return {
    check: (answer: ChoiceAnswer) => void check({ answer, timedOut: false }),
    end: () => dispatch({ type: "end" }),
    next: () => {
      shownAt.current = Date.now();
      dispatch({ type: "next" });
    },
    notSure: () => void check({ answer: NOT_SURE, timedOut: false }),
    // Reading the question counts toward the answer's time, so the reveal keeps the clock going.
    reveal: () => dispatch({ type: "reveal" }),
    select: (answer: ChoiceAnswer | null) => dispatch({ answer, type: "select" }),
    start: () => {
      shownAt.current = Date.now();
      dispatch({ type: "start" });
    },
    state,
    step,
    steps,
    timeUp: () => void check({ answer: NOT_SURE, timedOut: true }),
  };
}
