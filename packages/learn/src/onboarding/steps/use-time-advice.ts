"use client";

import {
  type PlanTimeAdvice,
  type PlanTimeAdviceInput,
} from "@zoonk/core/plans/time-advice-contract";
import { type PollStatus, usePoll } from "../../_utils/use-poll";

const ADVICE_POLL_MS = 3000;

/** The week the question shows: its study days, and the weekend's own time when it has one. */
export type StudyWeek = PlanTimeAdviceInput & { studyDays: number[] };

/** The plan's answer, with the week it was asked for. */
export type AdviceAnswer = { advice: PlanTimeAdvice; key: string };

/**
 * A weekend at another time than the weekdays keeps it when the daily time changes, so the time
 * recommended is the weekdays' with it; at the weekdays' time it's no time of its own.
 */
export function toStudyWeek({
  days,
  minutes,
  weekend,
}: {
  days: number[];
  minutes: string;
  weekend: string | null;
}): StudyWeek {
  return weekend === null || weekend === minutes
    ? { studyDays: days }
    : { studyDays: days, weekendMinutes: Number(weekend) };
}

/**
 * The plan's advice for this week, once it says it: an answer about another week (the one the
 * learner just changed, still on screen while this one is asked about) isn't this week's.
 */
export function getWeekAdvice({
  answer,
  week,
}: {
  answer: AdviceAnswer | null;
  week: StudyWeek;
}): PlanTimeAdvice | null {
  return answer?.key === JSON.stringify(week) && answer.advice.ready ? answer.advice : null;
}

/**
 * Asks the goal's plan for the time the week needs, again whenever the week changes, right away
 * (the answer about the old week can take seconds, and is dropped when it comes: the pick waits
 * for this week's instead of moving to a week no longer shown). The plan may still be being built
 * when the question shows, so it asks until it's ready, for as long as any onboarding wait does
 * (Carla's took over four minutes, while five other learners started theirs): it never gives up
 * quietly, so asking that kept failing or ran too long says so, and `restart` asks again. While
 * the run building the plan is stopped (`stopped`), it waits for that run's "Try again".
 */
export function useTimeAdvice({
  answer,
  dated,
  getAdvice,
  onAnswer,
  stopped,
  week,
}: {
  answer: AdviceAnswer | null;
  /** Whether the goal has a date to cover it by: without one, there's nothing to recommend. */
  dated: boolean;
  getAdvice: (week: StudyWeek) => Promise<PlanTimeAdvice | null>;
  onAnswer: (answer: AdviceAnswer) => void;
  stopped: boolean;
  week: StudyWeek;
}): { restart: () => void; status: PollStatus } {
  const key = JSON.stringify(week);
  const current = getWeekAdvice({ answer, week }) !== null;

  return usePoll({
    active: dated && !current && !stopped,
    intervalMs: ADVICE_POLL_MS,
    key,
    onPoll: async (signal) => {
      const advice = await getAdvice(week);

      if (signal.aborted) {
        return;
      }

      if (!advice) {
        throw new Error("The goal's daily time couldn't be read");
      }

      onAnswer({ advice, key });
    },
  });
}
