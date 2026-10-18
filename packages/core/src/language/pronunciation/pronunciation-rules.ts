import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";

/**
 * Days until a mispronounced word comes back, one rung per time it's said right: the next day,
 * three days later, then a week. Said right on the last rung, it leaves the reviews.
 */
const PRONUNCIATION_LADDER_DAYS = [1, 3, 7] as const;

/** A round asks a few words at a time; the rest wait for the next one. */
export const MAX_PRONUNCIATION_ROUND_WORDS = 8;

export type PronunciationSchedule = { dueAt: Date | null; stage: number };

/** The start of the learner's day `days` after the day `now` falls on, so reviews come back in the morning. */
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

/** A word just mispronounced, or missed again in a review: back to the first rung. */
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

/**
 * Where a review goes after an answer: a miss starts over; a word said right climbs one rung, and
 * one said right on the last rung is learned (`dueAt` null).
 */
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

/** A word as the sentence wrote it ("rent?", "¿Cuánto") without the punctuation around it. */
export function toReviewWord(text: string): string {
  return text.replaceAll(EDGE_PUNCTUATION, "").trim();
}
