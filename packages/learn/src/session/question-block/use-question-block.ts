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

const FIRST_HYPERDRIVE_LEVEL = 2;

const FAILED = { status: "failed" } as const;

export type QuestionBlockActions = {
  answer: (input: {
    answer: StudyQuestionAnswer;
    durationMs: number;
    itemId: string;
  }) => Promise<StudyAnswerOutcome>;
  finish: () => Promise<StudyFinishOutcome>;
  refresh: () => void;
};

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
    const outcome = await actions.finish().catch(() => FAILED);

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

    const outcome = await actions
      .answer({
        answer,
        durationMs: Math.max(minDurationMs, Math.round(performance.now() - shownAt.current)),
        itemId: question.itemId,
      })
      .catch(() => FAILED);

    if (outcome.status === "answered") {
      trackHyperdrive(outcome.feedback.hyperdrive.level);
      dispatch({ answer, feedback: outcome.feedback, itemId: question.itemId, type: "answered" });
      return;
    }

    if (outcome.status === "alreadyAnswered") {
      dispatch({ type: "alreadyAnswered" });
      return;
    }

    if (outcome.status === "blockNotActive") {
      actions.refresh();
      return;
    }

    dispatch({ type: "answerFailed" });
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
