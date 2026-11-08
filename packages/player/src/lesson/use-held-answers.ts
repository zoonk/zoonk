"use client";

import { gradeStepAnswer } from "@zoonk/core/lesson-player/grade";
import { type Dispatch, type RefObject, useCallback } from "react";
import { fromLocalGrade } from "./_utils/lesson-results";
import {
  type UnsentAnswer,
  dropUnsentAnswer,
  keepUnsentAnswer,
  readUnsentAnswers,
} from "./_utils/unsent-answers";
import { type LessonPlayerAction } from "./lesson-player-state";
import {
  type LessonPlayerAdapters,
  type LessonPlayerLesson,
  type LessonRunAnswers,
} from "./lesson-player-types";
import { useWhenBack } from "./use-when-back";

export type StartedRun = { learnerId: string; runId: string };

type HeldCheck = Omit<UnsentAnswer, "runId">;

/** Until the run exists, an answer has no run to be saved in, so it isn't on the device yet. */
export type HeldAnswer = { check: HeldCheck; fromDevice: boolean; run: StartedRun | null };

/** `sending`: the screen's held answers going out, oldest first, which every trigger joins. */
export type ScreenQueue = { last: Promise<unknown>; sending: Promise<boolean> | null };

export type HeldLesson = Pick<LessonPlayerLesson, "id" | "language" | "steps">;

export function toRunAnswer({
  check,
  lesson,
}: {
  check: HeldCheck;
  lesson: HeldLesson;
}): LessonRunAnswers[number] {
  const { answer, answeredAt, isCorrect, stepId } = check;
  const step = lesson.steps.find((item) => item.id === stepId);
  const graded = step ? gradeStepAnswer({ answer, language: lesson.language, step }) : null;

  return {
    answer: graded ? answer : null,
    answeredAt,
    isCorrect,
    result: fromLocalGrade(
      graded ?? {
        answerText: null,
        correctAnswer: null,
        expected: null,
        feedback: null,
        isCorrect,
      },
    ),
    stepId,
  };
}

function byAnsweredAt(first: HeldAnswer, second: HeldAnswer): number {
  return Date.parse(first.check.answeredAt) - Date.parse(second.check.answeredAt);
}

/** This tab's answers keep their order: a clock set back could put a retry before its miss. */
function findNext(held: Map<string, HeldAnswer>, stepId: string): HeldAnswer | undefined {
  const screen = [...held.values()].filter((answer) => answer.check.stepId === stepId);
  const own = screen.find((answer) => !answer.fromDevice);
  const [kept] = screen.filter((answer) => answer.fromDevice).toSorted(byAnsweredAt);
  return kept && (!own || byAnsweredAt(kept, own) < 0) ? kept : own;
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
  lesson,
}: {
  adapters: LessonPlayerAdapters;
  dispatch: Dispatch<LessonPlayerAction>;
  ensureRun: () => Promise<StartedRun | null>;
  getQueue: (stepId: string) => ScreenQueue;
  heldRef: RefObject<Map<string, HeldAnswer>>;
  keepPending: <T>(request: Promise<T>) => Promise<T>;
  lesson: HeldLesson;
}) {
  const lessonId = lesson.id;

  const keepInRun = useCallback(
    async (check: HeldCheck): Promise<StartedRun | null> => {
      const run = await ensureRun().catch(() => null);

      if (run && heldRef.current.has(check.attemptId)) {
        heldRef.current.set(check.attemptId, { check, fromDevice: false, run });
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
        const next = findNext(heldRef.current, stepId);
        const saved = next ? await send(next) : true;

        if (next && saved) {
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
      heldRef.current.set(check.attemptId, { check, fromDevice: false, run: null });
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
        if (!heldRef.current.has(check.attemptId)) {
          heldRef.current.set(check.attemptId, {
            check,
            fromDevice: true,
            run: { learnerId, runId },
          });
        }
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

      return kept.map((check) => toRunAnswer({ check, lesson }));
    },
    [ensureRun, holdKept, lesson, resendHeld],
  );

  /** Before the run ends, so the server never turns away an answer another tab still holds. */
  const resendKept = useCallback(async (): Promise<boolean> => {
    const run = await ensureRun().catch(() => null);

    if (run) {
      holdKept(run.learnerId);
    }

    return resendHeld();
  }, [ensureRun, holdKept, resendHeld]);

  useWhenBack(() => void resendHeld());

  return { hold, reopen, resendHeld, resendKept };
}
