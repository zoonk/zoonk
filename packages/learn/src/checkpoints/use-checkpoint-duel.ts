"use client";

import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { type ListeningSetView } from "@zoonk/core/library/listening/view";
import { type StudyBlockCompletionView } from "@zoonk/core/sessions/completion-contract";
import { useEffect, useReducer, useRef } from "react";
import {
  type CheckpointAnswer,
  type CheckpointDuelState,
  checkpointDuelReducer,
  createDuelState,
  getCurrentQuestion,
  getDuelScore,
} from "./checkpoint-duel-state";

/** Each resolves to null when the request didn't go through. */
export type CheckpointActions = {
  answer: (input: {
    answer: CheckpointAnswer;
    durationMs: number;
    itemId: string;
  }) => Promise<{
    isCorrect: boolean;
    reinforcementLessons: number | null;
    transcript: ListeningSetView["transcript"];
  } | null>;
  finish: () => Promise<StudyBlockCompletionView | null>;
};

const MAX_ANSWER_MS = 3_600_000;

export type CheckpointDuel = {
  confirm: () => Promise<void>;
  next: () => Promise<void>;
  retry: () => Promise<void>;
  select: (answer: CheckpointAnswer | null) => void;
  state: CheckpointDuelState;
};

export function useCheckpointDuel({
  actions,
  checkpoint,
}: {
  actions: CheckpointActions;
  checkpoint: CheckpointView;
}): CheckpointDuel {
  const [state, dispatch] = useReducer(checkpointDuelReducer, checkpoint, createDuelState);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    shownAt.current ??= Date.now();
  }, []);

  async function finish() {
    dispatch({ type: "pending" });
    const completion = await actions.finish().catch(() => null);

    if (!completion) {
      dispatch({ error: "finish", type: "failed" });
      return;
    }

    dispatch({ completion, type: "finished" });
  }

  async function confirm() {
    const question = getCurrentQuestion({ checkpoint, state });

    const answer = state.selected;

    if (!question || !answer || state.pending || state.feedback) {
      return;
    }

    dispatch({ answer, type: "confirm" });

    const result = await actions
      .answer({
        answer,
        durationMs: Math.min(MAX_ANSWER_MS, shownAt.current ? Date.now() - shownAt.current : 0),
        itemId: question.itemId,
      })
      .catch(() => null);

    if (!result) {
      dispatch({ error: "answer", type: "failed" });
      return;
    }

    const setId = question.set?.id;

    dispatch({
      isCorrect: result.isCorrect,
      itemId: question.itemId,
      recording: setId && result.transcript ? { setId, transcript: result.transcript } : null,
      reinforcementLessons: result.reinforcementLessons,
      type: "answered",
    });
  }

  async function next() {
    dispatch({ type: "next" });
    shownAt.current = Date.now();

    if (getDuelScore({ checkpoint, state }).done) {
      await finish();
    }
  }

  async function retry() {
    if (state.error === "finish") {
      await finish();
      return;
    }

    await confirm();
  }

  return { confirm, next, retry, select: (answer) => dispatch({ answer, type: "select" }), state };
}
