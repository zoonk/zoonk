"use client";

import { useState, useTransition } from "react";
import { usePoll } from "../_utils/use-poll";
import { type GenerationRun } from "../generation/generation-run";
import { type PlacementAnswer, type PlacementOutcome } from "../onboarding/onboarding-actions";
import { useReadOnOpen } from "../onboarding/steps/use-read-on-open";
import { isRunStopped } from "../onboarding/steps/wait-run";
import { type FocusTestActions } from "./focus-test-actions";
import {
  type FocusTestPhase,
  type QuestionPhase,
  type SittingEnd,
  toFocusTestPhase,
} from "./focus-test-phase";

const POLL_MS = 3000;

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

function useTestState({ actions, run }: { actions: FocusTestActions; run: GenerationRun | null }) {
  const [phase, setPhase] = useState<FocusTestPhase>({ kind: "loading" });
  const [buildFailed, setBuildFailed] = useState(false);
  // Questions that arrived while the learner waited show once the wait moves on.
  const [arrived, setArrived] = useState<PlacementOutcome | null>(null);

  useReadOnOpen({
    onRead: (outcome) => setPhase(toFocusTestPhase({ opening: true, outcome: outcome ?? FAILED })),
    read: actions.get,
  });

  const hear = (outcome: PlacementOutcome) => {
    if (outcome.status === "failed") {
      throw new Error("The test couldn't be read");
    }

    setBuildFailed(outcome.status === "generationFailed");

    if (outcome.status === "unavailable") {
      setPhase({ kind: "unavailable" });
    }

    if (outcome.status === "ready") {
      setArrived(outcome);
    }
  };

  // A run that failed or never started pauses checking until its "Try again" starts it over.
  const poll = usePoll({
    active: phase.kind === "waiting" && arrived === null && !isRunStopped(run),
    intervalMs: POLL_MS,
    onPoll: async () => hear(await actions.get()),
  });

  return { arrived, buildFailed, phase, poll, setArrived, setPhase };
}

export function useFocusTest({
  actions,
  onDone,
  run,
}: {
  actions: FocusTestActions;
  onDone: () => Promise<boolean>;
  run: GenerationRun | null;
}) {
  const { arrived, buildFailed, phase, poll, setArrived, setPhase } = useTestState({
    actions,
    run,
  });

  const [failed, setFailed] = useState(false);
  const [pressed, setPressed] = useState<Pressed>(null);
  const [isPending, startTransition] = useTransition();
  const leave = () => onDone().catch(() => false);

  /** Closing applies the answers; a test that still has none is only skipped, and the host moves on. */
  const close = async (end: SittingEnd | null): Promise<boolean> => {
    const finished = await actions.finish().catch(() => null);

    if (!finished) {
      return false;
    }

    if (finished.focusTest?.checkpoint) {
      setPhase({ end, focusTest: finished.focusTest, kind: "checkpoint" });
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

    const closed = await close(next.end);

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
      if (!(await close(null).catch(() => false))) {
        setPhase((current) => countFailure({ current, from }));
      }
    });

  return {
    answer,
    buildFailed,
    continueWait: () => {
      if (arrived) {
        setArrived(null);
        save(null, () => show(arrived));
      }
    },
    failed,
    isPending,
    onContinueTest: () => save("other", start),
    onDone: () => save("main", leave),
    onFinish: (end: SittingEnd | null) => save("main", () => close(end)),
    /** A learner who never started has nothing to close on a plan that's already theirs. */
    onLeave: (closes: boolean) => save("other", () => (closes ? close(null) : leave())),
    onStart: () => save("main", start),
    phase,
    poll,
    pressed,
    questionsReady: arrived !== null,
    resume: (question: QuestionPhase) => setPhase(question),
    stop,
  };
}
