import { type LearnerSkill } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type Card, type Grade, Rating, S_MIN, State, createEmptyCard, fsrs } from "ts-fsrs";
import { getLocalDaysBetween, getStartOfLocalDay } from "./_utils/local-time";
import { type GradedAnswer, type ReviewRating, isUnaidedRecall, rateAnswer } from "./answer-rating";
import { TARGET_RETENTION, getMasteryState } from "./mastery-state";

/** The memory columns of `LearnerSkill`: what FSRS and the mastery states read and write. */
export type SkillMemory = Pick<
  LearnerSkill,
  "difficulty" | "due" | "lapses" | "lastReviewedAt" | "recallDays" | "reps" | "stability" | "state"
>;

/** A skill the learner has never answered: New, with no schedule. */
export const NEW_SKILL_MEMORY: SkillMemory = {
  difficulty: 0,
  due: null,
  lapses: 0,
  lastReviewedAt: null,
  recallDays: 0,
  reps: 0,
  stability: 0,
  state: "new",
};

/** A skill nobody has looked at for a year still gets checked once a year. */
const MAX_REVIEW_INTERVAL_DAYS = 365;
const MIN_DIFFICULTY = 1;

/**
 * FSRS-6 through ts-fsrs, scheduling in whole days. Short-term learning steps are off because a
 * skill is reviewed across days (the session puts a missed question back at the end of a lesson by
 * itself), and fuzz is off so the same answers always give the same schedule. Same-day answers
 * still count: FSRS sees a retrievability of 1, so a right answer keeps stability and a wrong one
 * lowers it.
 */
const scheduler = fsrs({
  enable_fuzz: false,
  enable_short_term: false,
  maximum_interval: MAX_REVIEW_INTERVAL_DAYS,
  request_retention: TARGET_RETENTION,
});

const GRADES: Readonly<Record<ReviewRating, Grade>> = {
  again: Rating.Again,
  easy: Rating.Easy,
  good: Rating.Good,
  hard: Rating.Hard,
};

function hasMemoryState(memory: SkillMemory): boolean {
  return memory.reps > 0 && memory.stability >= S_MIN && memory.difficulty >= MIN_DIFFICULTY;
}

/**
 * FSRS counts elapsed days in UTC calendar days. Feeding it learner-local dates (as UTC-midnight
 * labels) makes "a day later" mean the learner's next day, wherever they live.
 */
function toCard({
  memory,
  today,
  timeZone,
}: {
  memory: SkillMemory;
  today: Date;
  timeZone: string;
}): Card {
  if (!hasMemoryState(memory) || !memory.lastReviewedAt) {
    return createEmptyCard(today);
  }

  return {
    ...createEmptyCard(today),
    difficulty: memory.difficulty,
    due: memory.due ?? today,
    lapses: memory.lapses,
    last_review: getDateInTimeZone({ date: memory.lastReviewedAt, timeZone }),
    reps: memory.reps,
    stability: memory.stability,
    state: State.Review,
  };
}

/**
 * The first answer on a skill usually comes right after it was taught, so it can't show the skill
 * is easy to remember yet: Easy is capped at Good until the skill has been reviewed once.
 */
function getRating({
  answer,
  memory,
}: {
  answer: GradedAnswer;
  memory: SkillMemory;
}): ReviewRating {
  const rating = rateAnswer(answer);
  return memory.reps === 0 && rating === "easy" ? "good" : rating;
}

/**
 * Counts learner-local days the skill was remembered. Only the first answer of a later day counts:
 * right and unaided adds a day, anything else is a lapse and starts the count over. Answers on the
 * day a skill is first seen never count, since that is learning, not remembering.
 */
function getRecallDays({
  answer,
  memory,
  reviewedAt,
  timeZone,
}: {
  answer: GradedAnswer;
  memory: SkillMemory;
  reviewedAt: Date;
  timeZone: string;
}): number {
  if (memory.reps === 0 || !memory.lastReviewedAt) {
    return 0;
  }

  const isLaterDay =
    getLocalDaysBetween({ from: memory.lastReviewedAt, timeZone, to: reviewedAt }) > 0;

  if (!isLaterDay) {
    return memory.recallDays;
  }

  return isUnaidedRecall(answer) ? memory.recallDays + 1 : 0;
}

/**
 * The learner-local day a skill comes back. A skill being learned (taught today, or relearned
 * after a lapse) and not yet recalled on a later day comes back the next day at the latest: the
 * quick questions that used to close a lesson move to the next day's review, when recalling helps
 * most, and FSRS spaces the reviews after that first recall. Diagnostic answers (placement,
 * test-outs, inferred knowledge) show what the learner already knew, so FSRS alone schedules them.
 */
function getDueDay({
  fsrsDue,
  learning,
  recallDays,
  today,
}: {
  fsrsDue: Date;
  learning: boolean;
  recallDays: number;
  today: Date;
}): Date {
  const tomorrow = new Date(today.getTime() + MS_PER_DAY);

  return learning && recallDays === 0 && fsrsDue > tomorrow ? tomorrow : fsrsDue;
}

/**
 * Applies one graded answer to a skill's memory: an FSRS review in learner-local days, the recall
 * day count and the mastery state. The next due date is the start of the learner's due day.
 * `learning` is true for answers while learning (lessons, reviews, practice), false for
 * diagnostics, which measure what the learner knew before being taught.
 */
export function reviewSkillMemory({
  answer,
  learning = false,
  memory,
  reviewedAt,
  timeZone,
}: {
  answer: GradedAnswer;
  learning?: boolean;
  memory: SkillMemory;
  reviewedAt: Date;
  timeZone: string;
}): SkillMemory {
  const today = getDateInTimeZone({ date: reviewedAt, timeZone });
  const rating = getRating({ answer, memory });
  const { card } = scheduler.next(toCard({ memory, timeZone, today }), today, GRADES[rating]);
  const recallDays = getRecallDays({ answer, memory, reviewedAt, timeZone });
  const dueDay = getDueDay({ fsrsDue: card.due, learning, recallDays, today });

  const next = {
    difficulty: card.difficulty,
    due: getStartOfLocalDay({ localDate: dueDay, timeZone }),
    lapses: card.lapses,
    lastReviewedAt: reviewedAt,
    recallDays,
    reps: card.reps,
    stability: card.stability,
  };

  return { ...next, state: getMasteryState(next) };
}

/**
 * The chance (0 to 1) the learner recalls the skill right now, from the FSRS forgetting curve.
 * Null for a skill that was never answered.
 */
export function getSkillRetrievability({
  memory,
  now,
}: {
  memory: SkillMemory;
  now: Date;
}): number | null {
  if (!hasMemoryState(memory) || !memory.lastReviewedAt) {
    return null;
  }

  const elapsedDays = Math.max(0, (now.getTime() - memory.lastReviewedAt.getTime()) / MS_PER_DAY);

  return scheduler.forgetting_curve(elapsedDays, memory.stability);
}
