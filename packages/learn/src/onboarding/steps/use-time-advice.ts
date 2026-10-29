"use client";

import {
  type PlanTimeAdvice,
  type PlanTimeAdviceInput,
  type PlanTimeToCover,
} from "@zoonk/core/plans/time-advice-contract";
import { useState } from "react";
import { type PollStatus, usePoll } from "../../_utils/use-poll";
import { type FindStatus } from "../../plan/plan-coverage";
import { type ExamFinish } from "../../plan/plan-full-course";
import { requestWithin } from "../../plan/use-time-to-cover";

const ADVICE_POLL_MS = 3000;

export type StudyWeek = Omit<PlanTimeAdviceInput, "dailyMinutes"> & { studyDays: number[] };

export type AdviceAnswer = { advice: PlanTimeAdvice; key: string; minutes: number };

/** Times not asked about are unknown: extra time can change the exam's mock cadence. */
type PickedShare = { known: boolean; share: number | null };

export function toStudyWeek({
  days,
  fullCourse = false,
  minutes,
  weekend,
}: {
  days: number[];
  fullCourse?: boolean;
  minutes: string;
  weekend: string | null;
}): StudyWeek {
  const week =
    weekend === null || weekend === minutes
      ? { studyDays: days }
      : { studyDays: days, weekendMinutes: Number(weekend) };

  return fullCourse ? { ...week, fullCourse } : week;
}

export function toFindWeek({
  days,
  weekend,
}: {
  days: number[];
  weekend: string | null;
}): StudyWeek {
  return weekend === null
    ? { studyDays: days }
    : { studyDays: days, weekendMinutes: Number(weekend) };
}

export function getWeekAdvice({
  answer,
  week,
}: {
  answer: AdviceAnswer | null;
  week: StudyWeek;
}): PlanTimeAdvice | null {
  return answer?.key === JSON.stringify(week) && answer.advice.ready ? answer.advice : null;
}

export function getPickedShare({
  advice,
  answer,
  found,
  minutes,
}: {
  advice: PlanTimeAdvice | null;
  answer: AdviceAnswer | null;
  found: Pick<PlanTimeToCover, "recommendedMinutes"> | null;
  minutes: number;
}): PickedShare {
  if (!advice) {
    return { known: false, share: null };
  }

  if (answer?.minutes === minutes) {
    return { known: true, share: advice.coveredShare };
  }

  if (found && minutes === found.recommendedMinutes) {
    return { known: true, share: 1 };
  }

  return { known: false, share: null };
}

export function getFullCourseEnd({
  advice,
  answer,
  minutes,
}: {
  advice: PlanTimeAdvice | null;
  answer: AdviceAnswer | null;
  minutes: number;
}): ExamFinish | null {
  const endDate = answer?.minutes === minutes ? advice?.fullCourseEndDate : null;

  return endDate && advice?.targetDate
    ? {
        dailyMinutes: minutes,
        endDate,
        targetDate: advice.targetDate,
        targetDateNamedMonth: advice.targetDateNamedMonth,
      }
    : null;
}

export function keepsFullCourse({
  checked,
  pickedShare,
}: {
  checked: boolean;
  pickedShare: PickedShare;
}): boolean {
  const coversEverything = pickedShare.known && (pickedShare.share ?? 0) >= 1;
  return checked && !coversEverything;
}

function hasStopped(status: PollStatus): boolean {
  return status === "failed" || status === "timedOut";
}

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
    retry: failed,
    share: pickedShare.known ? pickedShare.share : (lastAdvice?.coveredShare ?? null),
    stale,
    staleMinutes: stale ? (answer?.minutes ?? null) : null,
  };
}

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

export function useTimeAdvice({
  answer,
  getAdvice,
  known,
  minutes,
  onAnswer,
  stopped,
  week,
}: {
  answer: AdviceAnswer | null;
  getAdvice: (week: StudyWeek & { dailyMinutes: number }) => Promise<PlanTimeAdvice | null>;
  known: boolean;
  minutes: number;
  onAnswer: (answer: AdviceAnswer) => void;
  stopped: boolean;
  week: StudyWeek;
}): { restart: () => void; status: PollStatus } {
  const key = JSON.stringify(week);
  const current = getWeekAdvice({ answer, week }) !== null;

  return usePoll({
    active: week.studyDays.length > 0 && !(current && known) && !stopped,
    intervalMs: ADVICE_POLL_MS,
    key: JSON.stringify({ ...week, dailyMinutes: minutes }),
    onPoll: async (signal) => {
      const advice = await getAdvice({ ...week, dailyMinutes: minutes });

      if (signal.aborted) {
        return;
      }

      if (!advice) {
        throw new Error("What the goal's daily time covers couldn't be read");
      }

      onAnswer({ advice, key, minutes });
    },
  });
}

type WeekFindState =
  | { status: "idle" }
  | { key: string; status: "building" | "failed" | "pending" }
  | { key: string; status: "answered"; time: PlanTimeToCover };

const IDLE: WeekFindState = { status: "idle" };

export function useWeekTimeToCover({
  findTimeToCover,
  key,
  week,
}: {
  findTimeToCover: (week: StudyWeek) => Promise<PlanTimeToCover | null>;
  key: string;
  week: StudyWeek;
}): { find: () => Promise<void>; found: PlanTimeToCover | null; status: FindStatus } {
  const [state, setState] = useState<WeekFindState>(IDLE);
  const current = state.status !== "idle" && state.key === key ? state : IDLE;

  const find = async () => {
    const request = { key, status: "pending" } as const;
    setState(request);

    const time = await requestWithin(() => findTimeToCover(week));

    const next: WeekFindState = time?.ready
      ? { key, status: "answered", time }
      : { key, status: time ? "building" : "failed" };

    setState((now) => (now === request ? next : now));
  };

  return {
    find,
    found: current.status === "answered" ? current.time : null,
    status: current.status,
  };
}
