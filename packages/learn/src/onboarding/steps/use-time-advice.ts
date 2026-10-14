"use client";

import {
  type PlanTimeAdvice,
  type PlanTimeAdviceInput,
} from "@zoonk/core/plans/time-advice-contract";
import { type PollStatus, usePoll } from "../../_utils/use-poll";

const ADVICE_POLL_MS = 3000;

/** The week the question shows: its study days, and the weekend's own time when it has one. */
export type StudyWeek = Omit<PlanTimeAdviceInput, "dailyMinutes"> & { studyDays: number[] };

/**
 * The plan's answer, with the week it was asked for (`key`) and the time a day whose share of the
 * goal it says (`minutes`).
 */
export type AdviceAnswer = { advice: PlanTimeAdvice; key: string; minutes: number };

/**
 * What the time a day picked covers by the goal's date, and whether that's known for this time:
 * what the plan said for this very time, or the exact recommended or maximum time's share.
 * Other times are unknown until asked about: extra time can change the exam's mock cadence.
 */
export type PickedShare = { known: boolean; share: number | null };

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
 * What the time a day picked covers (see `PickedShare`). The time recommended and the most time
 * need no question of their own: the plan's answer already says what they cover.
 */
export function getPickedShare({
  advice,
  answer,
  minutes,
}: {
  /** The plan's advice for the week shown, once it says it (`getWeekAdvice`). */
  advice: PlanTimeAdvice | null;
  answer: AdviceAnswer | null;
  minutes: number;
}): PickedShare {
  if (!advice) {
    return { known: false, share: null };
  }

  if (answer?.minutes === minutes) {
    return { known: true, share: advice.coveredShare };
  }

  if (minutes === advice.recommendedMinutes) {
    return { known: true, share: 1 };
  }

  if (advice.maximum && minutes === advice.maximum.dailyMinutes) {
    return { known: true, share: advice.maximum.coveredShare };
  }

  return { known: false, share: null };
}

/** Asking stopped: it kept failing, or it ran too long. */
function hasStopped(status: PollStatus): boolean {
  return status === "failed" || status === "timedOut";
}

/**
 * What the estimate shows: what the time picked covers, or, while another time is asked about, the
 * last share known, dimmed (`stale`), instead of a blank, with the time it was for
 * (`staleMinutes`). When asking for the time picked stopped (`failed`), the estimate says so with
 * a way to ask again (`retry`), unless the week's advice failed too, where the sentence above
 * says it once for both.
 */
export function getEstimate({
  advice,
  answer,
  pickedShare,
  status,
}: {
  advice: PlanTimeAdvice | null;
  answer: AdviceAnswer | null;
  pickedShare: PickedShare;
  status: PollStatus;
}) {
  const lastAdvice = answer?.advice.ready ? answer.advice : null;
  const stale = !pickedShare.known;
  const failed = stale && hasStopped(status);

  return {
    advice: advice ?? lastAdvice,
    failed,
    retry: failed && advice !== null,
    share: pickedShare.known ? pickedShare.share : (lastAdvice?.coveredShare ?? null),
    stale,
    staleMinutes: stale ? (answer?.minutes ?? null) : null,
  };
}

/**
 * Whether there's an estimate to show: none for a plan that says no share (nothing to cover by),
 * and none once asking for it failed before any share came, where the sentence above says so;
 * but when only the time picked couldn't be asked about, the estimate says so with its retry.
 */
export function hasEstimate({
  estimate,
  pickedShare,
  status,
}: {
  estimate: { retry: boolean; share: number | null };
  pickedShare: PickedShare;
  status: PollStatus;
}): boolean {
  if (pickedShare.known) {
    return pickedShare.share !== null;
  }

  return estimate.share !== null || estimate.retry || !hasStopped(status);
}

/**
 * Asks the goal's plan for the time the week needs, again whenever the week changes, right away
 * (the answer about the old week can take seconds, and is dropped when it comes: the pick waits
 * for this week's instead of moving to a week no longer shown). The plan may still be being built
 * when the question shows, so it asks until it's ready, for as long as any onboarding wait does
 * (Carla's took over four minutes, while five other learners started theirs): it never gives up
 * quietly, so asking that kept failing or ran too long says so, and `restart` asks again. While
 * the run building the plan is stopped (`stopped`), it waits for that run's "Try again". Each
 * other time a day picked is asked about too, for what it covers (`known`), unless the answer
 * already says it.
 */
export function useTimeAdvice({
  answer,
  dated,
  getAdvice,
  known,
  minutes,
  onAnswer,
  stopped,
  week,
}: {
  answer: AdviceAnswer | null;
  /** Whether the goal has a date to cover it by: without one, there's nothing to recommend. */
  dated: boolean;
  getAdvice: (week: StudyWeek & { dailyMinutes: number }) => Promise<PlanTimeAdvice | null>;
  /** Whether what the time picked covers is known (see `getPickedShare`). */
  known: boolean;
  /** The time a day picked, whose share of the goal the answer says. */
  minutes: number;
  onAnswer: (answer: AdviceAnswer) => void;
  stopped: boolean;
  week: StudyWeek;
}): { restart: () => void; status: PollStatus } {
  const key = JSON.stringify(week);
  const current = getWeekAdvice({ answer, week }) !== null;

  return usePoll({
    active: dated && !(current && known) && !stopped,
    intervalMs: ADVICE_POLL_MS,
    key: JSON.stringify({ ...week, dailyMinutes: minutes }),
    onPoll: async (signal) => {
      const advice = await getAdvice({ ...week, dailyMinutes: minutes });

      if (signal.aborted) {
        return;
      }

      if (!advice) {
        throw new Error("The goal's daily time couldn't be read");
      }

      onAnswer({ advice, key, minutes });
    },
  });
}
