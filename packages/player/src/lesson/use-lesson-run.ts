"use client";

import { type Dispatch, useCallback, useRef } from "react";
import { type LessonPlayerAction } from "./lesson-player-state";
import { type LessonPlayerAdapters } from "./lesson-player-types";

type BackgroundCheck = () => Promise<boolean>;

/** A check that couldn't reach the server (offline, a dropped request) is unsaved, never thrown. */
function settle(check: BackgroundCheck): Promise<boolean> {
  return check().catch(() => false);
}

/**
 * Owns the run on the server: one start per run (a double mount or a retry reuses it), and the
 * answers graded on the device that still have to be recorded. The completion waits for them, so
 * the server sees every answer before it counts the run.
 */
export function useLessonRun({
  adapters,
  dispatch,
}: {
  adapters: LessonPlayerAdapters;
  dispatch: Dispatch<LessonPlayerAction>;
}) {
  const runRef = useRef<Promise<string | null> | null>(null);
  const pendingRef = useRef(new Set<Promise<boolean>>());
  const failedRef = useRef<BackgroundCheck[]>([]);

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

  const track = useCallback((check: BackgroundCheck) => {
    const pending = settle(check).then((saved) => {
      if (!saved) {
        failedRef.current = [...failedRef.current, check];
      }

      return saved;
    });

    pendingRef.current.add(pending);
    void pending.finally(() => pendingRef.current.delete(pending));
  }, []);

  /** Waits for answers still on their way and sends again the ones that failed. */
  const flushChecks = useCallback(async (): Promise<boolean> => {
    await Promise.allSettled(pendingRef.current);

    const retries = failedRef.current;
    failedRef.current = [];

    const results = await Promise.all(retries.map((check) => settle(check)));
    const stillFailed = retries.filter((_, index) => !results[index]);

    failedRef.current = stillFailed;
    return stillFailed.length === 0;
  }, []);

  return { ensureRun, flushChecks, track };
}
