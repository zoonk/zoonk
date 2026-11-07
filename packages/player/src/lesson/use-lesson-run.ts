"use client";

import { type Dispatch, useCallback, useRef } from "react";
import { type LessonPlayerAction } from "./lesson-player-state";
import { type LessonPlayerAdapters } from "./lesson-player-types";
import {
  type HeldAnswer,
  type ScreenQueue,
  type StartedRun,
  toRunAnswer,
  useHeldAnswers,
} from "./use-held-answers";

export function useLessonRun({
  adapters,
  dispatch,
  lessonId,
}: {
  adapters: LessonPlayerAdapters;
  dispatch: Dispatch<LessonPlayerAction>;
  lessonId: string;
}) {
  const runRef = useRef<Promise<StartedRun | null> | null>(null);
  const pendingRef = useRef(new Set<Promise<unknown>>());
  const screensRef = useRef(new Map<string, ScreenQueue>());
  const heldRef = useRef(new Map<string, HeldAnswer>());

  const ensureRun = useCallback((): Promise<StartedRun | null> => {
    if (runRef.current) {
      return runRef.current;
    }

    dispatch({ type: "runStarting" });

    const run = adapters.startLesson().then((outcome) => {
      if (outcome.reason === "started") {
        dispatch({
          answers: outcome.answers,
          held: [...heldRef.current.values()].map((held) => toRunAnswer(held.check)),
          hyperdrive: outcome.hyperdrive,
          optionalStepIds: outcome.optionalStepIds,
          replay: outcome.replay,
          runId: outcome.runId,
          startedAt: outcome.startedAt,
          type: "runStarted",
        });

        return { learnerId: outcome.learnerId, runId: outcome.runId };
      }

      runRef.current = null;
      dispatch({ refusal: outcome, type: "runRefused" });
      return null;
    });

    runRef.current = run;
    return run;
  }, [adapters, dispatch]);

  const keepPending = useCallback(<T>(request: Promise<T>): Promise<T> => {
    pendingRef.current.add(request);

    void request.then(
      () => pendingRef.current.delete(request),
      () => pendingRef.current.delete(request),
    );

    return request;
  }, []);

  const getQueue = useCallback((stepId: string): ScreenQueue => {
    const queue = screensRef.current.get(stepId) ?? { last: Promise.resolve(), sending: null };
    screensRef.current.set(stepId, queue);
    return queue;
  }, []);

  const keepGrade = useCallback(
    <T>({ request, stepId }: { request: Promise<T>; stepId: string }): Promise<T> => {
      const queue = getQueue(stepId);
      queue.last = Promise.allSettled([queue.last, request]);
      return keepPending(request);
    },
    [getQueue, keepPending],
  );

  const { hold, reopen, resendHeld, resendKept } = useHeldAnswers({
    adapters,
    dispatch,
    ensureRun,
    getQueue,
    heldRef,
    keepPending,
    lessonId,
  });

  const flushChecks = useCallback(async (): Promise<boolean> => {
    await Promise.allSettled(pendingRef.current);
    return resendKept();
  }, [resendKept]);

  return { ensureRun, flushChecks, hold, keepGrade, reopen, resendHeld };
}
