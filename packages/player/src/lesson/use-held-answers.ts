"use client";

import { type Dispatch, type RefObject, useCallback, useEffect } from "react";
import {
  type UnsentAnswer,
  dropUnsentAnswer,
  keepUnsentAnswer,
  readUnsentAnswers,
} from "./_utils/unsent-answers";
import { type LessonPlayerAction } from "./lesson-player-state";
import { type LessonPlayerAdapters, type LessonRunAnswers } from "./lesson-player-types";

export type StartedRun = { learnerId: string; runId: string };

type HeldCheck = Omit<UnsentAnswer, "runId">;

/** Until the run exists, an answer has no run to be saved in, so it isn't on the device yet. */
export type HeldAnswer = { check: HeldCheck; run: StartedRun | null };

/** `sending`: the screen's held answers going out, oldest first, which every trigger joins. */
export type ScreenQueue = { last: Promise<unknown>; sending: Promise<boolean> | null };

export function toRunAnswer({ answeredAt, isCorrect, stepId }: HeldCheck) {
  return { answeredAt, isCorrect, stepId };
}

function findOldest(held: Map<string, HeldAnswer>, stepId: string): HeldAnswer | undefined {
  return [...held.values()]
    .filter((answer) => answer.check.stepId === stepId)
    .toSorted(
      (first, second) => Date.parse(first.check.answeredAt) - Date.parse(second.check.answeredAt),
    )
    .at(0);
}

/**
 * Answers graded on the device whose save hasn't been confirmed: kept on the device until the
 * server checks or refuses them, and sent again, a screen's oldest first, on each trigger.
 */
export function useHeldAnswers({
  adapters,
  dispatch,
  ensureRun,
  getQueue,
  heldRef,
  keepPending,
  lessonId,
}: {
  adapters: LessonPlayerAdapters;
  dispatch: Dispatch<LessonPlayerAction>;
  ensureRun: () => Promise<StartedRun | null>;
  getQueue: (stepId: string) => ScreenQueue;
  heldRef: RefObject<Map<string, HeldAnswer>>;
  keepPending: <T>(request: Promise<T>) => Promise<T>;
  lessonId: string;
}) {
  const keepInRun = useCallback(
    async (check: HeldCheck): Promise<StartedRun | null> => {
      const run = await ensureRun().catch(() => null);

      if (run && heldRef.current.has(check.attemptId)) {
        heldRef.current.set(check.attemptId, { check, run });
        const answer = { ...check, runId: run.runId };
        keepUnsentAnswer({ answer, learnerId: run.learnerId, lessonId });
      }

      return run;
    },
    [ensureRun, heldRef, lessonId],
  );

  const send = useCallback(
    async (held: HeldAnswer): Promise<boolean> => {
      const { answer, attemptId, durationMs, stepId, usedHelp } = held.check;
      const run = held.run ?? (await keepInRun(held.check));

      const outcome =
        run &&
        (await adapters
          .checkStep({ answer, attemptId, durationMs, runId: run.runId, stepId, usedHelp })
          .catch(() => null));

      if (outcome?.status === "checked") {
        dispatch({ attemptId, result: outcome.result, stepId, type: "checkConfirmed" });
      }

      if (!run || (outcome?.status !== "checked" && outcome?.status !== "refused")) {
        dispatch({ type: "saveFailed" });
        return false;
      }

      heldRef.current.delete(attemptId);
      dropUnsentAnswer({ attemptId, learnerId: run.learnerId, lessonId });

      if (heldRef.current.size === 0) {
        dispatch({ type: "allSaved" });
      }

      return true;
    },
    [adapters, dispatch, heldRef, keepInRun, lessonId],
  );

  const resendScreen = useCallback(
    (stepId: string): Promise<boolean> => {
      const queue = getQueue(stepId);

      // Stops at the first answer that doesn't get through, so a miss never lands after its retry.
      const sendInOrder = async (): Promise<boolean> => {
        const oldest = findOldest(heldRef.current, stepId);
        const saved = oldest ? await send(oldest) : true;

        if (oldest && saved) {
          return sendInOrder();
        }

        // In the same step as the last look at what's held, so an answer held later starts a new send.
        queue.sending = null;
        return saved;
      };

      if (!queue.sending) {
        queue.sending = keepPending(queue.last.then(sendInOrder));
        queue.last = queue.sending;
      }

      return queue.sending;
    },
    [getQueue, heldRef, keepPending, send],
  );

  const resendHeld = useCallback(async (): Promise<boolean> => {
    const stepIds = new Set([...heldRef.current.values()].map((held) => held.check.stepId));
    const sent = await Promise.all([...stepIds].map((stepId) => resendScreen(stepId)));
    return sent.every(Boolean);
  }, [heldRef, resendScreen]);

  const hold = useCallback(
    (check: HeldCheck) => {
      heldRef.current.set(check.attemptId, { check, run: null });
      void keepInRun(check);

      void resendScreen(check.stepId).then((saved) => {
        if (saved) {
          void resendHeld();
        }
      });
    },
    [heldRef, keepInRun, resendHeld, resendScreen],
  );

  const holdKept = useCallback(
    (learnerId: string): UnsentAnswer[] => {
      const kept = readUnsentAnswers({ learnerId, lessonId });

      for (const { runId, ...check } of kept) {
        heldRef.current.set(check.attemptId, { check, run: { learnerId, runId } });
      }

      return kept;
    },
    [heldRef, lessonId],
  );

  /** Holds the answers the device kept for this learner and sends them before the run starts. */
  const reopen = useCallback(
    (learnerId: string): LessonRunAnswers => {
      const kept = holdKept(learnerId);

      if (kept.length > 0) {
        void resendHeld().then(() => ensureRun());
      }

      return kept.map((answer) => toRunAnswer(answer));
    },
    [ensureRun, holdKept, resendHeld],
  );

  /** Before the run ends, so the server never turns away an answer another tab still holds. */
  const resendKept = useCallback(async (): Promise<boolean> => {
    const run = await ensureRun().catch(() => null);

    if (run) {
      holdKept(run.learnerId);
    }

    return resendHeld();
  }, [ensureRun, holdKept, resendHeld]);

  useEffect(() => {
    const resendWhenBack = () => {
      if (document.visibilityState === "visible") {
        void resendHeld();
      }
    };

    globalThis.addEventListener("online", resendWhenBack);
    document.addEventListener("visibilitychange", resendWhenBack);

    return () => {
      globalThis.removeEventListener("online", resendWhenBack);
      document.removeEventListener("visibilitychange", resendWhenBack);
    };
  }, [resendHeld]);

  return { hold, reopen, resendHeld, resendKept };
}
