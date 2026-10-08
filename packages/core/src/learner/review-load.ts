import { MS_PER_DAY } from "@zoonk/utils/date";
import { getStartOfLocalDay } from "./_utils/local-time";
import { type SkillMemory, getSkillRetrievability } from "./fsrs-scheduler";

/** A studied skill that may need a review, with its FSRS memory. */
export type ReviewCandidate = { skillId: string; memory: SkillMemory };

/**
 * About a third of the daily study time goes to reviews, and one quick review question takes about
 * 45 seconds. The cap keeps even a long break from turning into a wall of reviews.
 */
export const REVIEW_SHARE_OF_DAY = 0.3;
export const MINUTES_PER_REVIEW = 0.75;
const MIN_REVIEWS_PER_DAY = 3;
const MAX_REVIEWS_PER_DAY = 30;

/** How many skills one day's reviews can hold at the learner's daily study time. */
export function getDailyReviewCap({ dailyMinutes }: { dailyMinutes: number }): number {
  const reviews = Math.round((dailyMinutes * REVIEW_SHARE_OF_DAY) / MINUTES_PER_REVIEW);
  return Math.min(MAX_REVIEWS_PER_DAY, Math.max(MIN_REVIEWS_PER_DAY, reviews));
}

function isDueBy(candidate: ReviewCandidate, until: Date): boolean {
  return candidate.memory.due !== null && candidate.memory.due < until;
}

/** Lowest chance of recall first (most at risk of being forgotten), then the longest overdue. */
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

/**
 * Picks the reviews for one day: skills due before `until` (usually the end of the learner's
 * day), most at risk first, never more than `cap`. Skills left out stay due and come first on the
 * next days, so missed days re-flow instead of piling up.
 */
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

/**
 * Forecasts the review load of the next `days` learner-local days under the daily cap. Overdue
 * skills spread over the first days rather than landing on one, which is what "Opens Friday" and
 * plan estimates read. A skill reviewed in the forecast is not rescheduled inside it.
 */
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
