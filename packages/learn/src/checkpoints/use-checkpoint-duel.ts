"use client";

import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { type StudyBlockCompletionView } from "@zoonk/core/sessions/completion-contract";
import { useReducer, useRef } from "react";
import { type LearnAnalytics, useLearnAnalytics } from "../learn-context";
import {
  type CheckpointAnswer,
  type CheckpointDuelState,
  checkpointDuelReducer,
  createDuelState,
  getCurrentQuestion,
  getDuelScore,
} from "./checkpoint-duel-state";

/**
 * How the screen reaches the server: the host wires these to the study session's block
 * capabilities. Each resolves to null (or false) when the request didn't go through.
 */
export type CheckpointActions = {
  answer: (input: {
    answer: CheckpointAnswer;
    durationMs: number;
    itemId: string;
  }) => Promise<{ isCorrect: boolean } | null>;
  finish: () => Promise<StudyBlockCompletionView | null>;
  /** "Move to Monday" for the week's challenge. */
  move: () => Promise<ChallengeMove | null>;
  start: () => Promise<boolean>;
  undoMove: (changeId: string) => Promise<boolean>;
};

/** Where the week's challenge went, and the plan change that undoes it. */
export type ChallengeMove = { changeId: string | null; date: string };

const MILESTONE_EVENT_KINDS = {
  badge: "badge",
  belt: "belt",
  buddyStage: "buddy_stage",
  glasses: "glasses",
} as const;

/** The duel's result and what it earned, for the shared event catalog (the host adds `mode`). */
function trackFinish({
  analytics,
  completion,
}: {
  analytics: LearnAnalytics;
  completion: StudyBlockCompletionView;
}) {
  const result = completion.checkpoint;

  if (result?.kind === "weekly") {
    analytics.track({
      name: "Big Challenge Finished",
      properties: { correct: result.correct, questions: result.total },
    });
  } else if (result) {
    analytics.track({
      name: "Boss Finished",
      properties: { boss: result.kind === "finalBoss" ? "final" : "phase", passed: result.passed },
    });
  }

  for (const milestone of completion.milestones) {
    analytics.track({
      name: "Milestone Earned",
      properties: { key: milestone.key, milestone: MILESTONE_EVENT_KINDS[milestone.kind] },
    });
  }
}

/** Longer than this, the learner took a break: the answer's time is capped, never refused. */
const MAX_ANSWER_MS = 3_600_000;

export type CheckpointDuel = {
  begin: () => Promise<void>;
  confirm: () => Promise<void>;
  next: () => Promise<void>;
  retry: () => Promise<void>;
  select: (answer: CheckpointAnswer | null) => void;
  state: CheckpointDuelState;
};

/** Runs a checkpoint: start it, answer one question at a time, then finish for the result. */
export function useCheckpointDuel({
  actions,
  checkpoint,
}: {
  actions: CheckpointActions;
  checkpoint: CheckpointView;
}): CheckpointDuel {
  const analytics = useLearnAnalytics();
  const [state, dispatch] = useReducer(checkpointDuelReducer, checkpoint, createDuelState);
  const shownAt = useRef<number | null>(null);

  async function begin() {
    dispatch({ type: "pending" });
    const started = await actions.start();

    if (!started) {
      dispatch({ error: "start", type: "failed" });
      return;
    }

    shownAt.current = Date.now();
    dispatch({ type: "started" });
  }

  async function finish() {
    dispatch({ type: "pending" });
    const completion = await actions.finish();

    if (!completion) {
      dispatch({ error: "finish", type: "failed" });
      return;
    }

    dispatch({ completion, type: "finished" });
    trackFinish({ analytics, completion });
  }

  async function confirm() {
    const question = getCurrentQuestion({ checkpoint, state });

    if (!question || !state.selected || state.pending || state.feedback) {
      return;
    }

    dispatch({ type: "pending" });

    const result = await actions.answer({
      answer: state.selected,
      durationMs: Math.min(MAX_ANSWER_MS, shownAt.current ? Date.now() - shownAt.current : 0),
      itemId: question.itemId,
    });

    if (!result) {
      dispatch({ error: "answer", type: "failed" });
      return;
    }

    dispatch({ isCorrect: result.isCorrect, itemId: question.itemId, type: "answered" });
  }

  async function next() {
    dispatch({ type: "next" });
    shownAt.current = Date.now();

    if (getDuelScore({ checkpoint, state }).done) {
      await finish();
    }
  }

  async function retry() {
    if (state.error === "start") {
      await begin();
      return;
    }

    if (state.error === "finish") {
      await finish();
      return;
    }

    await confirm();
  }

  return {
    begin,
    confirm,
    next,
    retry,
    select: (answer) => dispatch({ answer, type: "select" }),
    state,
  };
}
