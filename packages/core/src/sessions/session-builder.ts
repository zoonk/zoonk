import { type StudyFreshStart, type StudySessionBlock } from "@zoonk/db";
import { type PlannedProduce, toProduceBlock } from "../exams/essays/produce-block";
import { MINUTES_PER_REVIEW, REVIEW_SHARE_OF_DAY } from "../learner/review-load";
import {
  type BlockCapsule,
  type BlockCheckpoint,
  type BlockDrill,
  type BlockPayload,
  toBlockPayload,
} from "./block-payload";
import { getLightMinutes } from "./fresh-start";

/** An exam-format question takes longer than a quick review: reading, working it out, checking. */
export const PRACTICE_MINUTES_PER_QUESTION = 1.5;

/** Shorter than this, a block isn't worth a stop of its own. */
export const MIN_BLOCK_MINUTES = 3;

/** Fresh starts carry no backlog: reviews take half their usual share of the day. */
const FRESH_START_REVIEW_FACTOR = 0.5;

/**
 * Mixed practice stays small while the basics are learned, then grows with the plan, and most of
 * all in the month and week before an exam, when practicing in the exam's format pays the most.
 */
const BASICS_SHARE_OF_PLAN = 0.15;
const EARLY_PRACTICE_SHARE = 0.1;
const BASE_PRACTICE_SHARE = 0.2;
const PRACTICE_GROWTH = 0.3;
const EXAM_MONTH_DAYS = 30;
const EXAM_MONTH_BOOST = 0.2;
const EXAM_WEEK_DAYS = 7;
const MAX_PRACTICE_SHARE = 0.6;

/** The share of a session's learning time that goes to mixed practice. */
export function getPracticeShare({
  daysToExam,
  planProgress,
}: {
  /** Days until the exam, or null for goals without one. */
  daysToExam: number | null;
  /** The share of plan items done, from 0 to 1. */
  planProgress: number;
}): number {
  if (daysToExam !== null && daysToExam <= EXAM_WEEK_DAYS) {
    return MAX_PRACTICE_SHARE;
  }

  const base =
    planProgress < BASICS_SHARE_OF_PLAN
      ? EARLY_PRACTICE_SHARE
      : BASE_PRACTICE_SHARE + PRACTICE_GROWTH * planProgress;

  const boost = daysToExam !== null && daysToExam <= EXAM_MONTH_DAYS ? EXAM_MONTH_BOOST : 0;

  return Math.min(MAX_PRACTICE_SHARE, base + boost);
}

/** A lesson or chapter from the plan, ready to become a learn block. */
export type PlannedLesson = {
  canDo: string | null;
  chapterId: string | null;
  lessonId: string | null;
  minutes: number;
  planItemId: string | null;
  skillIds: string[];
  title: string;
};

export type PlannedCheckpoint = BlockCheckpoint & {
  itemIds: string[];
  minutes: number;
  planItemId: string | null;
  skillIds: string[];
  title: string;
};

/** A practice question: its skill, weakest skills first so the block ends on stronger ground. */
export type PracticeItem = { itemId: string; skillId: string };

export type SessionBuildInput = {
  /** Today's due capsules, most urgent first, with their questions picked. */
  capsules: BlockCapsule[];
  checkpoint: PlannedCheckpoint | null;
  dailyMinutes: number;
  /** Today's mistake drill: the oldest open mistake from an earlier day. */
  drills: BlockDrill[];
  /** A free exam plan past its first days: reviews and fixes stay, new work waits for Plus. */
  examTrialEnded: boolean;
  /**
   * A few placement questions for skills whose starting point isn't settled, in the goal's first
   * week: they open the session, before the capsules.
   */
  placementItemIds: string[];
  freshStart: StudyFreshStart | null;
  lessons: PlannedLesson[];
  /** An exam where a wrong answer cancels a right one: mixed practice is scored net. */
  netScored: boolean;
  practice: PracticeItem[];
  /** An exam's essay to write today, graded with the official rubric; null on other days. */
  produce: PlannedProduce | null;
  /** The share of the day for mixed practice, from `getPracticeShare`. */
  practiceShare: number;
  /** Two short lessons before a boss rematch. */
  reinforcement: PlannedLesson[];
  /** A review day the plan scheduled: no new lessons, the day goes to reviews and practice. */
  reviewPlanItemId: string | null;
  /** Minutes left under a guardian's daily limit, or null without one. */
  remainingLimitMinutes: number | null;
};

export type PlannedBlock = Pick<StudySessionBlock, "canDo" | "kind" | "lessonId"> & {
  estimatedMinutes: number;
  payload: BlockPayload;
};

function toMinutes(value: number): number {
  return Math.max(1, Math.round(value));
}

function getSessionBudget(input: SessionBuildInput): number {
  const minutes =
    input.freshStart === "welcomeBack" ? getLightMinutes(input.dailyMinutes) : input.dailyMinutes;

  return Math.min(minutes, input.remainingLimitMinutes ?? minutes);
}

/** Capsules that fit the review share of the day; at least the most urgent one when any is due. */
function takeCapsules({
  budget,
  capsules,
  freshStart,
}: {
  budget: number;
  capsules: readonly BlockCapsule[];
  freshStart: StudyFreshStart | null;
}): BlockCapsule[] {
  const factor = freshStart ? FRESH_START_REVIEW_FACTOR : 1;
  const maxQuestions = Math.floor((budget * REVIEW_SHARE_OF_DAY * factor) / MINUTES_PER_REVIEW);

  return capsules.filter((_, index) => {
    const questions = capsules
      .slice(0, index + 1)
      .reduce((sum, capsule) => sum + capsule.itemIds.length, 0);

    return index === 0 || questions <= maxQuestions;
  });
}

function toLessonBlock(lesson: PlannedLesson, reinforcement: boolean): PlannedBlock {
  return {
    canDo: lesson.canDo,
    estimatedMinutes: toMinutes(lesson.minutes),
    kind: "learn",
    lessonId: lesson.lessonId,
    payload: toBlockPayload({
      chapterId: lesson.chapterId,
      planItemId: lesson.planItemId,
      reinforcement,
      skillIds: lesson.skillIds,
      title: lesson.title,
    }),
  };
}

/**
 * New lessons in plan order while they fit. The next lesson is always offered when there's some
 * room, even if it runs a little long, except under a guardian's limit, which is never exceeded.
 */
function takeLessons({
  budget,
  canOverflow,
  lessons,
}: {
  budget: number;
  canOverflow: boolean;
  lessons: readonly PlannedLesson[];
}): PlannedLesson[] {
  const fitting = lessons.filter(
    (_, index) =>
      lessons.slice(0, index + 1).reduce((sum, lesson) => sum + lesson.minutes, 0) <= budget,
  );

  const first = lessons[0];
  const offerNext = fitting.length === 0 && first && canOverflow && budget >= MIN_BLOCK_MINUTES;

  return offerNext ? [first] : fitting;
}

function getLessonMinutes(lessons: readonly PlannedLesson[]): number {
  return lessons.reduce((sum, lesson) => sum + toMinutes(lesson.minutes), 0);
}

function buildPracticeBlock({
  drills,
  minutes,
  netScored,
  planItemId,
  practice,
}: {
  drills: readonly BlockDrill[];
  minutes: number;
  netScored: boolean;
  planItemId: string | null;
  practice: readonly PracticeItem[];
}): PlannedBlock | null {
  const drillItems = drills.reduce((sum, drill) => sum + drill.itemIds.length, 0);
  const room = Math.floor(minutes / PRACTICE_MINUTES_PER_QUESTION) - drillItems;
  const items = practice.slice(0, Math.max(0, room));
  const questions = drillItems + items.length;
  const practiceMinutes = questions * PRACTICE_MINUTES_PER_QUESTION;

  if (questions === 0 || (drills.length === 0 && practiceMinutes < MIN_BLOCK_MINUTES)) {
    return null;
  }

  return {
    canDo: null,
    estimatedMinutes: toMinutes(practiceMinutes),
    kind: "practice",
    lessonId: null,
    payload: toBlockPayload({
      drills: [...drills],
      itemIds: items.map((item) => item.itemId),
      netScored,
      planItemId,
      skillIds: [...new Set(items.map((item) => item.skillId))],
    }),
  };
}

/** The easy start: a few placement questions in the first week, then today's capsules. */
function buildReviewBlock({
  capsules,
  placementItemIds,
}: {
  capsules: readonly BlockCapsule[];
  placementItemIds: readonly string[];
}): PlannedBlock | null {
  const questions =
    placementItemIds.length + capsules.reduce((sum, capsule) => sum + capsule.itemIds.length, 0);

  if (questions === 0) {
    return null;
  }

  return {
    canDo: null,
    estimatedMinutes: toMinutes(questions * MINUTES_PER_REVIEW),
    kind: "review",
    lessonId: null,
    payload: toBlockPayload({
      capsules: [...capsules],
      placementItemIds: [...placementItemIds],
      skillIds: capsules.flatMap((capsule) => capsule.skillIds),
    }),
  };
}

function buildCheckpointBlock(checkpoint: PlannedCheckpoint): PlannedBlock {
  const { itemIds, minutes, planItemId, skillIds, title, ...details } = checkpoint;

  return {
    canDo: null,
    estimatedMinutes: toMinutes(minutes),
    kind: "checkpoint",
    lessonId: null,
    payload: toBlockPayload({ checkpoint: details, itemIds, planItemId, skillIds, title }),
  };
}

/**
 * New lessons wait on the day of a first duel (practice prepares for it) and after a free exam
 * trial. A rematch never holds them back: losing a boss never locks the next phase.
 */
function getNewLessons(input: SessionBuildInput): readonly PlannedLesson[] {
  const checkpoint = input.checkpoint;
  const firstDuel = checkpoint !== null && checkpoint.kind !== "weekly" && !checkpoint.rematch;

  return firstDuel || input.examTrialEnded || input.reviewPlanItemId ? [] : input.lessons;
}

/**
 * Builds one day's session in the session shape: an easy start (capsules), the hard part in the
 * middle (new lessons, then mixed practice with mistake drills first), and the checkpoint last.
 * It fits the day's minutes: reviews take their share, a checkpoint takes what it needs, mixed
 * practice gets its growing share, and lessons fill the rest in plan order. A welcome back is
 * lighter, and a guardian's daily limit caps it.
 */
export function buildSessionBlocks(input: SessionBuildInput): {
  blocks: PlannedBlock[];
  plannedMinutes: number;
} {
  const budget = getSessionBudget(input);

  if (budget < MIN_BLOCK_MINUTES) {
    return { blocks: [], plannedMinutes: 0 };
  }

  const capsules = takeCapsules({ budget, capsules: input.capsules, freshStart: input.freshStart });
  const review = buildReviewBlock({ capsules, placementItemIds: input.placementItemIds });
  const checkpoint = input.examTrialEnded ? null : input.checkpoint;
  const base = (review?.estimatedMinutes ?? 0) + (checkpoint?.minutes ?? 0);

  const produce = toProduceBlock({
    ...input,
    minBlockMinutes: MIN_BLOCK_MINUTES,
    room: budget - base,
  });

  const remaining = Math.max(0, budget - base - (produce?.estimatedMinutes ?? 0));
  const reinforcement = input.examTrialEnded ? [] : input.reinforcement;
  const practiceShare = input.reviewPlanItemId ? 1 : input.practiceShare;
  const learnBudget = remaining * (1 - practiceShare) - getLessonMinutes(reinforcement);

  const lessons = takeLessons({
    budget: learnBudget,
    canOverflow: input.remainingLimitMinutes === null,
    lessons: getNewLessons(input),
  });

  const learnMinutes = getLessonMinutes([...reinforcement, ...lessons]);

  const blocks = [
    review,
    ...reinforcement.map((lesson) => toLessonBlock(lesson, true)),
    ...lessons.map((lesson) => toLessonBlock(lesson, false)),
    buildPracticeBlock({
      drills: input.drills,
      minutes: Math.max(0, remaining - learnMinutes),
      netScored: input.netScored,
      planItemId: input.reviewPlanItemId,
      practice: input.examTrialEnded ? [] : input.practice,
    }),
    produce,
    checkpoint ? buildCheckpointBlock(checkpoint) : null,
  ].filter((block) => block !== null);

  return { blocks, plannedMinutes: blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0) };
}
