"use client";

import { useState, useTransition } from "react";
import { type GenerationRun } from "../generation/generation-run";
import { type PlacementAnswer, type PlacementOutcome } from "../onboarding/onboarding-actions";
import { usePlacementQuestionPoll } from "../onboarding/steps/use-placement-question-poll";
import { useReadOnOpen } from "../onboarding/steps/use-read-on-open";
import { isRunStopped } from "../onboarding/steps/wait-run";
import { type FocusTestActions } from "./focus-test-actions";
import { type FocusTestPhase, type QuestionPhase, toFocusTestPhase } from "./focus-test-phase";

/** The button a save started from, which shows it's busy while the other waits. */
export type Pressed = "main" | "other" | null;

const FAILED: PlacementOutcome = { status: "failed" };

/** A save that failed counts on the question it came from, where its retry is. */
function countFailure({
  current,
  from,
}: {
  current: FocusTestPhase;
  from: QuestionPhase;
}): FocusTestPhase {
  return current.kind === "question" && current.question.itemId === from.question.itemId
    ? { ...current, failures: current.failures + 1 }
    : current;
}

function useTestState({
  actions,
  run,
  started,
}: {
  actions: FocusTestActions;
  run: GenerationRun | null;
  started: boolean;
}) {
  const [phase, setPhase] = useState<FocusTestPhase>({ kind: "loading" });
  const waiting = phase.kind === "waiting" ? phase : null;

  const reopen = useReadOnOpen({
    onRead: (outcome) =>
      setPhase(toFocusTestPhase({ opening: true, outcome: outcome ?? FAILED, started })),
    read: actions.get,
  });

  const poll = usePlacementQuestionPoll<FocusTestPhase>({
    onProgress: (wait, outcome) =>
      outcome.status === "unavailable"
        ? { kind: "unavailable" }
        : { ...wait, buildFailed: outcome.status === "generationFailed" },
    paused: isRunStopped(run),
    read: actions.get,
    setPhase,
    waiting,
  });

  return { phase, poll, reopen, setPhase, waiting };
}

export function useFocusTest({
  actions,
  onDone,
  run,
  started,
}: {
  actions: FocusTestActions;
  onDone: () => Promise<boolean>;
  run: GenerationRun | null;
  started: boolean;
}) {
  const { phase, poll, reopen, setPhase, waiting } = useTestState({ actions, run, started });

  const [failed, setFailed] = useState(false);
  const [pressed, setPressed] = useState<Pressed>(null);
  const [isPending, startTransition] = useTransition();
  const leave = () => onDone().catch(() => false);
  const arrived = waiting?.arrived;

  /** Closing applies the answers; a test that still has none is only skipped, and the host moves on. */
  const close = async (): Promise<boolean> => {
    const finished = await actions.finish().catch(() => null);

    if (!finished) {
      return false;
    }

    if (finished.focusTest?.checkpoint) {
      setPhase({ focusTest: finished.focusTest, kind: "checkpoint" });
      return true;
    }

    return leave();
  };

  /** A sitting that's over closes in the same save; if that fails, its screen holds the retry. */
  const show = async (outcome: PlacementOutcome): Promise<boolean> => {
    const next = toFocusTestPhase({ opening: false, outcome });

    if (next.kind !== "ended") {
      setPhase(next);
      return true;
    }

    const closed = await close();

    if (!closed) {
      setPhase(next);
    }

    return closed;
  };

  const save = (button: Pressed, action: () => Promise<boolean>) => {
    setPressed(button);
    setFailed(false);

    startTransition(async () => {
      const saved = await action().catch(() => false);
      setFailed(!saved);
      setPressed(null);
    });
  };

  const start = async (): Promise<boolean> => {
    const outcome = await actions.start().catch(() => FAILED);
    return outcome.status !== "failed" && show(outcome);
  };

  const answer = (from: QuestionPhase) => (choice: PlacementAnswer, durationMs: number) => {
    setFailed(false);

    startTransition(async () => {
      const outcome = await actions
        .answer({ answer: choice, durationMs, itemId: from.question.itemId })
        .catch(() => FAILED);

      if (outcome.status === "failed") {
        setPhase((current) => countFailure({ current, from }));
        return;
      }

      setFailed(!(await show(outcome).catch(() => false)));
    });
  };

  const stop = (from: QuestionPhase) =>
    startTransition(async () => {
      if (!(await close().catch(() => false))) {
        setPhase((current) => countFailure({ current, from }));
      }
    });

  return {
    answer,
    buildFailed: Boolean(waiting?.buildFailed && !arrived),
    continueWait: () => {
      if (arrived) {
        save(null, () => show(arrived));
      }
    },
    failed,
    isPending,
    onContinueTest: () => save("other", start),
    onDone: () => save("main", leave),
    onFinish: () => save("main", close),
    /** A learner who never started has nothing to close on a plan that's already theirs. */
    onLeave: (closes: boolean) => save("other", () => (closes ? close() : leave())),
    onStart: () => save("main", start),
    phase,
    poll,
    pressed,
    questionsReady: Boolean(arrived),
    reopen,
    resume: (question: QuestionPhase) => setPhase(question),
    stop,
  };
}
