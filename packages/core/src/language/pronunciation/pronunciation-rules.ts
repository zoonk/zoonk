import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";

const PRONUNCIATION_LADDER_DAYS = [1, 3, 7] as const;

export const MAX_PRONUNCIATION_ROUND_WORDS = 8;

export type PronunciationSchedule = { dueAt: Date | null; stage: number };

function startOfLocalDayAfter({
  days,
  now,
  timeZone,
}: {
  days: number;
  now: Date;
  timeZone: string;
}): Date {
  const today = getDateInTimeZone({ date: now, timeZone });

  return getStartOfLocalDay({ localDate: new Date(today.getTime() + days * MS_PER_DAY), timeZone });
}

export function schedulePronunciationMiss({
  now,
  timeZone,
}: {
  now: Date;
  timeZone: string;
}): PronunciationSchedule {
  const [firstWait] = PRONUNCIATION_LADDER_DAYS;
  return { dueAt: startOfLocalDayAfter({ days: firstWait, now, timeZone }), stage: 0 };
}

export function nextPronunciationReview({
  isCorrect,
  now,
  stage,
  timeZone,
}: {
  isCorrect: boolean;
  now: Date;
  stage: number;
  timeZone: string;
}): PronunciationSchedule {
  if (!isCorrect) {
    return schedulePronunciationMiss({ now, timeZone });
  }

  const nextStage = stage + 1;
  const wait = PRONUNCIATION_LADDER_DAYS[nextStage];

  if (wait === undefined) {
    return { dueAt: null, stage: nextStage };
  }

  return { dueAt: startOfLocalDayAfter({ days: wait, now, timeZone }), stage: nextStage };
}

const EDGE_PUNCTUATION = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;

export function toReviewWord(text: string): string {
  return text.replaceAll(EDGE_PUNCTUATION, "").trim();
}
