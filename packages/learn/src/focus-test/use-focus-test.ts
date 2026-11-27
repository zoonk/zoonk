"use client";

import { useState } from "react";
import { type GenerationRun } from "../generation/generation-run";
import { type PlacementAnswer, type PlacementOutcome } from "../onboarding/onboarding-actions";
import { usePlacementQuestionPoll } from "../onboarding/steps/use-placement-question-poll";
import { isRunStopped } from "../onboarding/steps/wait-run";
import { answerOrRead } from "../placement-test/placement-test-phase";
import { type TestPressed } from "../placement-test/test-offer";
import { type TestAnalytics } from "../placement-test/use-test-analytics";
import { useTestVisit } from "../placement-test/use-test-visit";
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
  run: build,
}: {
  actions: FocusTestActions;
  analytics: Pick<TestAnalytics, "markOpened" | "markStarted">;
  /** The learner asked for the test on the screen that led here, so it starts as it opens. */
  asked: boolean;
  onDone: () => Promise<boolean>;
  run: GenerationRun | null;
}) {
  const [phase, setPhase] = useState<FocusTestPhase>({ kind: "loading" });
  const [sittingsStarted, setSittingsStarted] = useState(0);
  const waiting = phase.kind === "waiting" ? phase : null;
  const leave = () => onDone().catch(() => false);
  const arrived = waiting?.arrived;

  const poll = usePlacementQuestionPoll<FocusTestPhase>({
    onProgress: (wait, outcome) =>
      outcome.status === "unavailable"
        ? { kind: "unavailable" }
        : { ...wait, buildFailed: outcome.status === "generationFailed" },
    paused: Boolean(waiting?.startFailed) || isRunStopped(build),
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

  const open = async (outcome: PlacementOutcome) => {
    const next = toFocusTestPhase({ opening: true, outcome });

    if (next.kind === "invitation" && asked) {
      if (!(await start())) {
        setPhase({ kind: "loadFailed" });
      }

      return;
    }

    setPhase(next);
  };

  const { failed, isPending, pressed, reopen, run, save, setFailed } = useTestVisit({
    onRead: (outcome) => open(outcome ?? FAILED),
    read: () => {
      analytics.markOpened();
      return actions.get();
    },
  });

  const answer = (from: QuestionPhase) => (choice: PlacementAnswer, durationMs: number) =>
    run(async () => {
      const outcome = await answerOrRead({
        answer: () => actions.answer({ answer: choice, durationMs, itemId: from.question.itemId }),
        question: from.question,
        read: actions.get,
      });

      if (!outcome) {
        setPhase((current) => countFailure({ current, from }));
        return;
      }

      setFailed(!(await show(outcome).catch(() => false)));
    });

  const stop = (from: QuestionPhase) =>
    run(async () => {
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

      const offered = toFocusTestPhase({ opening: false, outcome: arrived }).kind === "invitation";

      if (!asked || !offered) {
        save(null, () => show(arrived));
        return;
      }

      // Questions for a test the learner asked for before it could open: their start opens it now,
      // and one that doesn't go through waits for "Try again".
      run(async () => {
        if (!(await start())) {
          setPhase((current) =>
            current === waiting
              ? { answered: waiting.answered, kind: "waiting", startFailed: true }
              : current,
          );
        }
      });
    },
    failed,
    isPending,
    onContinueTest: () => save("other", start),
    onDone: () => save("main", leave),
    onFinish: () => save("main", close),
    /** A learner who never started has nothing to close on a plan that's already theirs. */
    onLeave: ({ button, closes }: { button: Exclude<TestPressed, null>; closes: boolean }) =>
      save(button, () => (closes ? close() : leave())),
    onRetryWait: () => {
      if (!isPending) {
        save("main", start);
      }
    },
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
