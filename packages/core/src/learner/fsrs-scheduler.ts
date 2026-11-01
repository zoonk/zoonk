import { type LearnerSkill } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type Grade, Rating, S_MIN, State, dateChrono, defineScheduler } from "ts-fsrs";
import {
  schedulerDesiredRetentionMiddleware,
  schedulerMaximumIntervalMiddleware,
  schedulerMonotonicIntervalMiddleware,
  schedulerStatsMiddleware,
} from "ts-fsrs/middlewares";
import { FSRS6Model, FSRS6_DEFAULT_WEIGHTS } from "ts-fsrs/models/fsrs-6";
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

/** Sessions handle immediate retries; leave out short-term steps and fuzz for deterministic schedules across days. */
const scheduler = defineScheduler({ chrono: dateChrono, model: FSRS6Model })
  .use(
    schedulerDesiredRetentionMiddleware,
    schedulerStatsMiddleware,
    schedulerMaximumIntervalMiddleware,
    schedulerMonotonicIntervalMiddleware,
  )
  .create({
    config: {
      desiredRetention: TARGET_RETENTION,
      enableShortTerm: false,
      maximumInterval: MAX_REVIEW_INTERVAL_DAYS,
      numRelearningSteps: 0,
      weights: FSRS6_DEFAULT_WEIGHTS,
    },
  });

type Card = ReturnType<typeof scheduler.newCard>;

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
  const card = scheduler.newCard({ now: today });

  if (!hasMemoryState(memory) || !memory.lastReviewedAt) {
    return card;
  }

  return {
    ...card,
    difficulty: memory.difficulty,
    dueAt: memory.due ?? today,
    lapses: memory.lapses,
    lastReviewAt: getDateInTimeZone({ date: memory.lastReviewedAt, timeZone }),
    reps: memory.reps,
    scheduleStatus: "review",
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

  const { card } = scheduler.review({
    card: toCard({ memory, timeZone, today }),
    grade: GRADES[rating],
    now: today,
  });

  const recallDays = getRecallDays({ answer, memory, reviewedAt, timeZone });
  const dueDay = getDueDay({ fsrsDue: card.dueAt, learning, recallDays, today });

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

  return scheduler.model.forgettingCurve(memory, elapsedDays);
}
