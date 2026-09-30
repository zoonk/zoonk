"use client";

import { useEffect, useEffectEvent, useReducer, useRef } from "react";
import { useLearnAnalytics } from "../../learn-context";
import {
  type StudyAnswerOutcome,
  type StudyBlockDetail,
  type StudyFinishOutcome,
  type StudyQuestionAnswer,
} from "../session-types";
import { createQuestionBlockState, questionBlockReducer } from "./question-block-state";

/** Hyperdrive starts to count from a double. */
const FIRST_HYPERDRIVE_LEVEL = 2;

export type QuestionBlockActions = {
  answer: (input: {
    answer: StudyQuestionAnswer;
    durationMs: number;
    itemId: string;
  }) => Promise<StudyAnswerOutcome>;
  finish: () => Promise<StudyFinishOutcome>;
};

/**
 * Runs a question block: one question at a time, graded on the server, resuming where the learner
 * left it, and finished with its completion moment once every question is answered.
 */
export function useQuestionBlock({
  actions,
  detail,
}: {
  actions: QuestionBlockActions;
  detail: StudyBlockDetail;
}) {
  const analytics = useLearnAnalytics();
  const total = detail.questions.length;

  const [state, dispatch] = useReducer(
    questionBlockReducer(total),
    detail,
    createQuestionBlockState,
  );

  const shownAt = useRef(0);
  const question = detail.questions[state.index] ?? null;

  useEffect(() => {
    shownAt.current = performance.now();
  }, []);

  const finish = useEffectEvent(async () => {
    const outcome = await actions.finish();

    if (outcome.status === "finished") {
      dispatch({ moment: outcome.moment, type: "finished" });
      return;
    }

    dispatch({ type: "finishFailed" });
  });

  useEffect(() => {
    if (state.phase.kind === "finishing") {
      void finish();
    }
  }, [state.phase.kind]);

  const trackHyperdrive = (level: number) => {
    if (level >= FIRST_HYPERDRIVE_LEVEL && level > state.hyperdrive) {
      analytics.track({ name: "Hyperdrive Reached", properties: { multiplier: level } });
    }
  };

  /** `minDurationMs` is a timed drill's whole time box when it ran out, however the clock ticked. */
  const submit = async (
    answer: StudyQuestionAnswer,
    { minDurationMs = 0 }: { minDurationMs?: number } = {},
  ) => {
    if (!question || (state.phase.kind !== "answering" && state.phase.kind !== "answerFailed")) {
      return;
    }

    dispatch({ type: "check" });

    const outcome = await actions.answer({
      answer,
      durationMs: Math.max(minDurationMs, Math.round(performance.now() - shownAt.current)),
      itemId: question.itemId,
    });

    if (outcome.status === "answered") {
      trackHyperdrive(outcome.feedback.hyperdrive.level);
      dispatch({ answer, feedback: outcome.feedback, itemId: question.itemId, type: "answered" });
      return;
    }

    // This session already has an answer to it (another tab, or a retry), so move on.
    if (outcome.status === "alreadyAnswered") {
      shownAt.current = performance.now();
      dispatch({ type: "next" });
      return;
    }

    dispatch({
      retryAfterSeconds: outcome.status === "slowDown" ? outcome.retryAfterSeconds : null,
      type: "answerFailed",
    });
  };

  return {
    next: () => {
      shownAt.current = performance.now();
      dispatch({ type: "next" });
    },
    question,
    retryFinish: () => dispatch({ type: "finish" }),
    state,
    submit,
    total,
  };
}
