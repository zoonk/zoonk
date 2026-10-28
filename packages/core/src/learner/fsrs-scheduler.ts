import { type LearnerSkill } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type Card, type Grade, Rating, S_MIN, State, createEmptyCard, fsrs } from "ts-fsrs";
import { getLocalDaysBetween, getStartOfLocalDay } from "./_utils/local-time";
import { type GradedAnswer, type ReviewRating, isUnaidedRecall, rateAnswer } from "./answer-rating";
import { TARGET_RETENTION, getMasteryState } from "./mastery-state";

export type SkillMemory = Pick<
  LearnerSkill,
  "difficulty" | "due" | "lapses" | "lastReviewedAt" | "recallDays" | "reps" | "stability" | "state"
>;

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

/** Even skills unreviewed for a year must be checked yearly. */
const MAX_REVIEW_INTERVAL_DAYS = 365;
const MIN_DIFFICULTY = 1;

/** Sessions handle immediate retries; disable short-term steps and fuzz for deterministic schedules across days. */
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

/** FSRS counts UTC calendar days, so pass learner-local UTC-midnight labels. */
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

/** A first answer cannot establish easy recall immediately after teaching, so cap it at Good. */
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

/** Learning returns by the next day until its first later-day recall; diagnostics use FSRS alone. */
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

/** learning distinguishes taught practice from diagnostics; due is the start of a learner-local day. */
export function reviewSkillMemory({
  answer,
  learning = false,
  memory,
  reviewedAt: answeredAt,
  timeZone,
}: {
  answer: GradedAnswer;
  learning?: boolean;
  memory: SkillMemory;
  reviewedAt: Date;
  timeZone: string;
}): SkillMemory {
  // Delayed grading must not move a skill's review clock backward.
  const reviewedAt =
    memory.lastReviewedAt && memory.lastReviewedAt > answeredAt
      ? memory.lastReviewedAt
      : answeredAt;

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

/** Probability from 0 to 1; null for a skill never answered. */
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
