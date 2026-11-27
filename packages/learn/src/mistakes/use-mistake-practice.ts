"use client";

import { MS_PER_SECOND } from "@zoonk/utils/date";
import { useEffect, useEffectEvent, useReducer, useRef, useState } from "react";
import { type ChoiceAnswer } from "../questions/choice-question";
import { type AnswerSender, getSentDurationMs } from "./drill/drill-types";
import {
  type MistakePracticeAnswer,
  type MistakePracticeFeedback,
  type MistakePracticeSummary,
  type PracticeAnswer,
  type PracticeEntry,
  type SentPracticeAnswer,
  createPracticeState,
  practiceReducer,
  toPracticeAnswer,
} from "./mistake-practice-state";
import { type RecordMistakeAction, usePracticeRecording } from "./use-practice-recording";

const NOT_SURE: ChoiceAnswer = { dontKnow: true };

/**
 * Each answer carries the run's earlier ones, so a run left halfway still counts; `finish` counts
 * it once more at the end, also with no answers: a day's block needs it to complete. `again` reads
 * a fresh batch in the run's scope.
 */
export type MistakePracticeActions = {
  record?: RecordMistakeAction;
  again: () => Promise<PracticeEntry[] | null>;
  answer: (answer: MistakePracticeAnswer) => Promise<MistakePracticeFeedback>;
  finish: (run: { answerIds: string[] }) => Promise<MistakePracticeSummary | null>;
};

/** A day's block (`dayBlock`) is over only once its finish is acknowledged: it completes Today's row. */
export function useMistakePractice({
  actions,
  dayBlock,
  practice,
}: {
  actions: MistakePracticeActions;
  dayBlock: boolean;
  practice: PracticeEntry[];
}) {
  const [state, dispatch] = useReducer(practiceReducer, practice, createPracticeState);
  const { steps } = state;
  const step = steps[state.index];
  const shownAt = useRef(0);

  const recording = usePracticeRecording({
    answerIds: state.answerIds,
    dispatch,
    elapsedMs: () => Date.now() - shownAt.current,
    index: state.index,
    record: actions.record,
    step,
  });

  const attempt = useRef<{ answer: string; id: string; index: number } | null>(null);
  const [again, setAgain] = useState<"failed" | "idle" | "loading">("idle");

  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

  const finish = useEffectEvent(async () => {
    // Elsewhere a count that didn't get through still ends the run: each answer counted as it came.
    const summary = await actions.finish({ answerIds: state.answerIds }).catch(() => null);
    dispatch(summary || !dayBlock ? { summary, type: "ended" } : { type: "finishFailed" });
  });

  useEffect(() => {
    if (state.phase.kind === "ending") {
      void finish();
    }
  }, [state.phase.kind]);

  const send = async ({ answer, durationMs }: SentPracticeAnswer) => {
    if (!step) {
      return;
    }

    if (
      attempt.current?.index !== state.index ||
      attempt.current.answer !== JSON.stringify(answer)
    ) {
      attempt.current = {
        answer: JSON.stringify(answer),
        id: crypto.randomUUID(),
        index: state.index,
      };
    }

    const feedback = await actions
      .answer(
        toPracticeAnswer({
          answer,
          attemptId: attempt.current.id,
          durationMs,
          runAnswerIds: state.answerIds,
          step,
        }),
      )
      .catch(() => null);

    if (!feedback) {
      dispatch({ type: "answerFailed" });
      return;
    }

    dispatch({ feedback, mistakeId: step.entry.mistakeId, type: "answered" });
  };

  const check = (answer: PracticeAnswer, sender: AnswerSender) => {
    const limitMs = (step?.entry.drill.timeLimitSeconds ?? 0) * MS_PER_SECOND;
    const elapsedMs = Date.now() - shownAt.current;

    const sent = {
      answer,
      durationMs: getSentDurationMs({
        answer,
        failed: state.phase.kind === "answerFailed" ? state.phase : null,
        measuredMs: sender === "timer" ? Math.max(elapsedMs, limitMs) : elapsedMs,
      }),
      sender,
    };

    dispatch({ ...sent, type: "check" });
    void send(sent);
  };

  const practiceAgain = async () => {
    setAgain("loading");
    const batch = await actions.again().catch(() => null);

    if (!batch) {
      setAgain("failed");
      return;
    }

    attempt.current = null;
    recording.reset();
    shownAt.current = Date.now();
    setAgain("idle");
    dispatch({ practice: batch, type: "again" });
  };

  return {
    again: { failed: again === "failed", loading: again === "loading", start: practiceAgain },
    check: (answer: PracticeAnswer) => check(answer, "check"),
    end: () => dispatch({ type: "end" }),
    next: () => {
      recording.reset();
      shownAt.current = Date.now();
      dispatch({ type: "next" });
    },
    notSure: () => check(NOT_SURE, "notSure"),
    record: recording.record,
    recordIssue: recording.recordIssue,
    retry: () => {
      if (state.phase.kind === "answerFailed") {
        dispatch({ type: "retry" });

        if (!recording.retry()) {
          void send(state.phase);
        }
      }
    },
    select: (answer: PracticeAnswer | null) => {
      recording.reset();
      dispatch({ answer, type: "select" });
    },
    start: () => {
      shownAt.current = Date.now();
      dispatch({ type: "start" });
    },
    state,
    step,
    steps,
    timeUp: () => check(NOT_SURE, "timer"),
  };
}
