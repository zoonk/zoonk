import { MS_PER_DAY } from "@zoonk/utils/date";
import { getStartOfLocalDay } from "./_utils/local-time";
import { type SkillMemory, getSkillRetrievability } from "./fsrs-scheduler";

export type ReviewCandidate = { skillId: string; memory: SkillMemory };

/** Cap reviews so returning after a long break does not create a wall of overdue work. */
export const REVIEW_SHARE_OF_DAY = 0.3;
export const MINUTES_PER_REVIEW = 0.75;
const MIN_REVIEWS_PER_DAY = 3;
const MAX_REVIEWS_PER_DAY = 30;

export function getDailyReviewCap({ dailyMinutes }: { dailyMinutes: number }): number {
  const reviews = Math.round((dailyMinutes * REVIEW_SHARE_OF_DAY) / MINUTES_PER_REVIEW);
  return Math.min(MAX_REVIEWS_PER_DAY, Math.max(MIN_REVIEWS_PER_DAY, reviews));
}

function isDueBy(candidate: ReviewCandidate, until: Date): boolean {
  return candidate.memory.due !== null && candidate.memory.due < until;
}

function compareReviewPriority({
  a,
  b,
  until,
}: {
  a: ReviewCandidate;
  b: ReviewCandidate;
  until: Date;
}): number {
  const recallA = getSkillRetrievability({ memory: a.memory, now: until }) ?? 0;
  const recallB = getSkillRetrievability({ memory: b.memory, now: until }) ?? 0;

  if (recallA !== recallB) {
    return recallA - recallB;
  }

  return (a.memory.due?.getTime() ?? 0) - (b.memory.due?.getTime() ?? 0);
}

/** Never exceeds cap; until is normally the end of the learner-local day. */
export function selectDueReviews({
  candidates,
  cap,
  until,
}: {
  candidates: readonly ReviewCandidate[];
  cap: number;
  until: Date;
}): ReviewCandidate[] {
  return candidates
    .filter((candidate) => isDueBy(candidate, until))
    .toSorted((a, b) => compareReviewPriority({ a, b, until }))
    .slice(0, cap);
}

type ForecastDay = { localDate: Date; reviews: number };

/** Spreads overdue work under the daily cap and does not reschedule forecasted reviews within the forecast. */
export function forecastReviewLoad({
  candidates,
  cap,
  days,
  from,
  timeZone,
}: {
  candidates: readonly ReviewCandidate[];
  cap: number;
  days: number;
  /** The learner-local date the forecast starts on, as a UTC-midnight label. */
  from: Date;
  timeZone: string;
}): ForecastDay[] {
  const dates = Array.from(
    { length: days },
    (_, index) => new Date(from.getTime() + index * MS_PER_DAY),
  );

  return dates.reduce<{ forecast: ForecastDay[]; pending: readonly ReviewCandidate[] }>(
    ({ forecast, pending }, localDate) => {
      const nextDay = new Date(localDate.getTime() + MS_PER_DAY);
      const until = getStartOfLocalDay({ localDate: nextDay, timeZone });
      const taken = new Set(selectDueReviews({ candidates: pending, cap, until }));

      return {
        forecast: [...forecast, { localDate, reviews: taken.size }],
        pending: pending.filter((candidate) => !taken.has(candidate)),
      };
    },
    { forecast: [], pending: candidates },
  ).forecast;
}
