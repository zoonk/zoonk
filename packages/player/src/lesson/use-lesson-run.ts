"use client";

import { type Dispatch, useCallback, useRef } from "react";
import { type LessonPlayerAction } from "./lesson-player-state";
import { type LessonPlayerAdapters } from "./lesson-player-types";

type BackgroundCheck = () => Promise<boolean>;

type ScreenQueue = { failed: BackgroundCheck[]; last: Promise<unknown> };

function settle(check: BackgroundCheck): Promise<boolean> {
  return check().catch(() => false);
}

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

  const inScreenOrder = useCallback(
    <T>(stepId: string, send: (queue: ScreenQueue) => Promise<T>): Promise<T> => {
      const queue = getQueue(stepId);
      const request = keepPending(queue.last.then(() => send(queue)));

      queue.last = request.catch(() => null);
      return request;
    },
    [getQueue, keepPending],
  );

  const keepGrade = useCallback(
    <T>({ request, stepId }: { request: Promise<T>; stepId: string }): Promise<T> => {
      const queue = getQueue(stepId);
      queue.last = Promise.allSettled([queue.last, request]);
      return keepPending(request);
    },
    [getQueue, keepPending],
  );

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

  const flushChecks = useCallback(async (): Promise<boolean> => {
    await Promise.allSettled(pendingRef.current);

    const resent = await Promise.all(
      [...screensRef.current.keys()].map((stepId) => inScreenOrder(stepId, resendFailed)),
    );

    return resent.every(Boolean);
  }, [inScreenOrder]);

  return { ensureRun, flushChecks, keepGrade, track };
}
