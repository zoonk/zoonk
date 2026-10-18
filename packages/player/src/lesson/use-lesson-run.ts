"use client";

import { type Dispatch, useCallback, useRef } from "react";
import { type LessonPlayerAction } from "./lesson-player-state";
import { type LessonPlayerAdapters } from "./lesson-player-types";

type BackgroundCheck = () => Promise<boolean>;

/**
 * One screen's requests: the last save or grade sent, which the next save waits for, and the saves
 * that didn't get through, which go again before the screen's next save.
 */
type ScreenQueue = { failed: BackgroundCheck[]; last: Promise<unknown> };

/** A check that couldn't reach the server (offline, a dropped request) is unsaved, never thrown. */
function settle(check: BackgroundCheck): Promise<boolean> {
  return check().catch(() => false);
}

/** Sends the screen's saves that didn't get through, oldest first; true once none is left. */
function resendFailed(queue: ScreenQueue): Promise<boolean> {
  const [next] = queue.failed;

  if (!next) {
    return Promise.resolve(true);
  }

  return settle(next).then((saved) => {
    if (!saved) {
      return false;
    }

    queue.failed = queue.failed.slice(1);
    return resendFailed(queue);
  });
}

/**
 * Owns the run on the server: one start per run (a double mount or a retry reuses it), and every
 * request that records an answer. A screen's saves go one after another, after its grades still on
 * their way too (a spoken answer's grade before the listening exercise that replaced it), as Server
 * Actions did, so the server records its answers in the order they were given (the first decides
 * the screen's verdict); other screens' requests go side by side. A save that didn't get through
 * goes again before the screen's next save, which waits until it does. Grades never wait: the
 * learner is waiting for them, and "Check again" after a grade the screen stopped waiting for goes
 * at once (the server doesn't record that earlier grade once the newer answer is recorded). The
 * completion waits for every request still on its way and sends the failed saves again, so the
 * server sees every answer before it counts the run, and none lands after it.
 */
export function useLessonRun({
  adapters,
  dispatch,
}: {
  adapters: LessonPlayerAdapters;
  dispatch: Dispatch<LessonPlayerAction>;
}) {
  const runRef = useRef<Promise<string | null> | null>(null);
  const pendingRef = useRef(new Set<Promise<unknown>>());
  const screensRef = useRef(new Map<string, ScreenQueue>());

  const ensureRun = useCallback((): Promise<string | null> => {
    if (runRef.current) {
      return runRef.current;
    }

    dispatch({ type: "runStarting" });

    const run = adapters.startLesson().then((outcome) => {
      if (outcome.reason === "started") {
        dispatch({
          answers: outcome.answers,
          hyperdrive: outcome.hyperdrive,
          optionalStepIds: outcome.optionalStepIds,
          runId: outcome.runId,
          startedAt: outcome.startedAt,
          type: "runStarted",
        });

        return outcome.runId;
      }

      runRef.current = null;
      dispatch({ refusal: outcome, type: "runRefused" });
      return null;
    });

    runRef.current = run;
    return run;
  }, [adapters, dispatch]);

  /** Keeps a request on the list the completion waits for until it settles. */
  const keepPending = useCallback(<T>(request: Promise<T>): Promise<T> => {
    pendingRef.current.add(request);

    void request.then(
      () => pendingRef.current.delete(request),
      () => pendingRef.current.delete(request),
    );

    return request;
  }, []);

  const getQueue = useCallback((stepId: string): ScreenQueue => {
    const queue = screensRef.current.get(stepId) ?? { failed: [], last: Promise.resolve() };
    screensRef.current.set(stepId, queue);
    return queue;
  }, []);

  /** Sends a screen's save once its earlier saves and grades settled. */
  const inScreenOrder = useCallback(
    <T>(stepId: string, send: (queue: ScreenQueue) => Promise<T>): Promise<T> => {
      const queue = getQueue(stepId);
      const request = keepPending(queue.last.then(() => send(queue)));

      queue.last = request.catch(() => null);
      return request;
    },
    [getQueue, keepPending],
  );

  /** Sends a grade at once; the screen's later saves wait for it, and so does the completion. */
  const keepGrade = useCallback(
    <T>({ request, stepId }: { request: Promise<T>; stepId: string }): Promise<T> => {
      const queue = getQueue(stepId);
      queue.last = Promise.allSettled([queue.last, request]);
      return keepPending(request);
    },
    [getQueue, keepPending],
  );

  /** Saves an answer graded on the device; one that doesn't get through waits to go again. */
  const track = useCallback(
    ({ check, stepId }: { check: BackgroundCheck; stepId: string }) => {
      void inScreenOrder(stepId, async (queue) => {
        if ((await resendFailed(queue)) && (await settle(check))) {
          return;
        }

        queue.failed = [...queue.failed, check];
      });
    },
    [inScreenOrder],
  );

  /**
   * Waits for every request still on its way (a grade the screen stopped waiting for may still be
   * recorded) and sends again each screen's saves that failed, in order.
   */
  const flushChecks = useCallback(async (): Promise<boolean> => {
    await Promise.allSettled(pendingRef.current);

    const resent = await Promise.all(
      [...screensRef.current.keys()].map((stepId) => inScreenOrder(stepId, resendFailed)),
    );

    return resent.every(Boolean);
  }, [inScreenOrder]);

  return { ensureRun, flushChecks, keepGrade, track };
}
