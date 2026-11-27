"use client";

import { useState } from "react";
import { type GenerationRun } from "../generation/generation-run";
import { type PlacementAnswer, type PlacementOutcome } from "../onboarding/onboarding-actions";
import { usePlacementQuestionPoll } from "../onboarding/steps/use-placement-question-poll";
import { useReadOnOpen } from "../onboarding/steps/use-read-on-open";
import { isRunStopped } from "../onboarding/steps/wait-run";
import { type TestPressed } from "../placement-test/test-offer";
import { type TestAnalytics } from "../placement-test/use-test-analytics";
import { useTestSaves } from "../placement-test/use-test-saves";
import { type FocusTestActions } from "./focus-test-actions";
import { type FocusTestPhase, type QuestionPhase, toFocusTestPhase } from "./focus-test-phase";

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

export function useFocusTest({
  actions,
  analytics,
  asked,
  onDone,
  run,
}: {
  actions: FocusTestActions;
  analytics: Pick<TestAnalytics, "markOpened" | "markStarted">;
  /** The learner asked for the test on the screen that led here, so it starts as it opens. */
  asked: boolean;
  onDone: () => Promise<boolean>;
  run: GenerationRun | null;
}) {
  const [phase, setPhase] = useState<FocusTestPhase>({ kind: "loading" });
  const saves = useTestSaves();
  const { failed, hasActed, isPending, markRead, pressed, save, setFailed } = saves;
  const [sittingsStarted, setSittingsStarted] = useState(0);
  const waiting = phase.kind === "waiting" ? phase : null;
  const leave = () => onDone().catch(() => false);
  const arrived = waiting?.arrived;

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

  const start = async (): Promise<boolean> => {
    analytics.markStarted();
    setSittingsStarted((count) => count + 1);
    const outcome = await actions.start().catch(() => FAILED);
    return outcome.status !== "failed" && show(outcome);
  };

  /** A read that comes back after the learner pressed something no longer says where they are. */
  const open = async (outcome: PlacementOutcome) => {
    if (hasActed()) {
      return;
    }

    const next = toFocusTestPhase({ opening: true, outcome });

    if (next.kind === "invitation" && asked) {
      if (!(await start())) {
        setPhase({ kind: "loadFailed" });
      }

      return;
    }

    setPhase(next);
  };

  const reopen = useReadOnOpen({
    onRead: (outcome) => void open(outcome ?? FAILED),
    read: () => {
      markRead();
      analytics.markOpened();
      return actions.get();
    },
  });

  const answer = (from: QuestionPhase) => (choice: PlacementAnswer, durationMs: number) =>
    saves.run(async () => {
      const outcome = await actions
        .answer({ answer: choice, durationMs, itemId: from.question.itemId })
        .catch(() => FAILED);

      if (outcome.status === "failed") {
        setPhase((current) => countFailure({ current, from }));
        return;
      }

      setFailed(!(await show(outcome).catch(() => false)));
    });

  const stop = (from: QuestionPhase) =>
    saves.run(async () => {
      if (!(await close().catch(() => false))) {
        setPhase((current) => countFailure({ current, from }));
      }
    });

  return {
    answer,
    buildFailed: Boolean(waiting?.buildFailed && !arrived),
    continueWait: () => {
      if (!arrived) {
        return;
      }

      // Questions for a test the learner asked for before it could open: their start opens it now.
      const offered = toFocusTestPhase({ opening: false, outcome: arrived }).kind === "invitation";
      save(null, () => (asked && offered ? start() : show(arrived)));
    },
    failed,
    isPending,
    onContinueTest: () => save("other", start),
    onDone: () => save("main", leave),
    onFinish: () => save("main", close),
    /** A learner who never started has nothing to close on a plan that's already theirs. */
    onLeave: ({ button, closes }: { button: Exclude<TestPressed, null>; closes: boolean }) =>
      save(button, () => (closes ? close() : leave())),
    onStart: () => save("main", start),
    phase,
    poll,
    pressed,
    questionsReady: Boolean(arrived),
    reopen,
    /** Tells one sitting from the next within a visit; 0 while the open one was resumed. */
    sittingsStarted,
    stop,
  };
}
