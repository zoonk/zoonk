import { type StudyFreshStart, type StudySessionBlock } from "@zoonk/db";
import { type PlannedProduce, toProduceBlock } from "../exams/essays/produce-block";
import { MINUTES_PER_REVIEW, REVIEW_SHARE_OF_DAY } from "../learner/review-load";
import { type DuelMarks, keepDuelLessons, splitAtDuel } from "./_utils/lessons-before-challenges";
import { buildCheckpointBlock } from "./_utils/planned-checkpoint-block";
import { takePracticeQuestions } from "./_utils/practice-sets";
import {
  type BlockCapsule,
  type BlockCheckpoint,
  type BlockDrill,
  type BlockPayload,
  toBlockPayload,
} from "./block-payload";
import { takeReviewCapsules } from "./capsules";
import { getLightMinutes } from "./fresh-start";
import { countFullReviewQuestions, isFullReview, isFullReviewDay } from "./full-review";

/** An exam-format question takes longer than a quick review: reading, working it out, checking. */
export const PRACTICE_MINUTES_PER_QUESTION = 1.5;

/** Shorter than this, a block isn't worth a stop of its own. */
export const MIN_BLOCK_MINUTES = 3;

/** Fresh starts carry no backlog: reviews take half their usual share of the day. */
const FRESH_START_REVIEW_FACTOR = 0.5;

/**
 * A lesson or chapter from the plan, ready to become a learn block, with where the plan has it
 * around the day's first duel (see `markLessonsAroundChallenges`).
 */
export type PlannedLesson = DuelMarks & {
  canDo: string | null;
  chapterId: string | null;
  lessonId: string | null;
  minutes: number;
  planItemId: string | null;
  planItemKey?: string | null;
  /** The plan item's skill: the subject the lesson block is labeled with. */
  planSkillId: string | null;
  skillIds: string[];
  title: string;
};

export type PlannedCheckpoint = BlockCheckpoint & {
  itemIds: string[];
  minutes: number;
  planItemId: string | null;
  planItemKey?: string | null;
  skillIds: string[];
  title: string;
};

/**
 * A practice question: its skill, weakest skills first so the block ends on stronger ground, and
 * its set when it shares a stimulus with the questions next to it (asked whole, never cut).
 */
export type PracticeItem = { itemId: string; setId?: string; skillId: string };

export type SessionBuildInput = {
  /** Today's due capsules, most urgent first, with their questions picked. */
  capsules: BlockCapsule[];
  /**
   * The day's challenges, the earlier phase's first (two when a half-studied day left one and the
   * next phase ends today), or its weekly checkpoint or mock.
   */
  checkpoints: PlannedCheckpoint[];
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
  /** The share of the day for mixed practice, from `getPracticeShare` (practice-share.ts). */
  practiceShare: number;
  /** Up to two available lessons before a boss rematch. */
  reinforcement: PlannedLesson[];
  /**
   * The goal's skills, on a day whose mock the learner's plan doesn't include (a free plan's): the
   * day is a full review instead, with no new lessons, its practice taking every skill in turn,
   * weakest first. Null on other days.
   */
  fullReviewSkillIds?: readonly string[] | null;
  /** A review day the plan scheduled: no new lessons, the day goes to reviews and practice. */
  reviewPlanItemId: string | null;
  /** A selected review is identified before Open assigns its persisted row ID. */
  reviewPlanItemKey?: string | null;
  /**
   * The capsules aren't due: a day with nothing due and nothing else to study reviews the
   * learner's weakest studied topics instead of staying empty, briefly, and says so.
   */
  weakestReview?: boolean;
  /** Minutes left under the learner's daily limit, or null without one. */
  remainingLimitMinutes: number | null;
  /**
   * Minutes the day's session already holds in blocks it keeps, when a plan change rebuilds the
   * rest of a day already underway: the new blocks fill what's left.
   */
  usedMinutes?: number;
  /**
   * Practice's share of the day as it opened, as its block's minutes of the day's, when a plan
   * change rebuilds the rest of a day already underway: practice keeps that share of the whole
   * day, not its share of what's left, so a change that leaves today alone leaves it as it was.
   */
  openedPractice?: { dayMinutes: number; minutes: number };
};

export type PlannedBlock = Pick<StudySessionBlock, "canDo" | "kind" | "lessonId"> & {
  estimatedMinutes: number;
  payload: BlockPayload;
};

function toMinutes(value: number): number {
  return Math.max(1, Math.round(value));
}

/** The questions the day's mistake drills ask, ahead of practice's own. */
function countDrilled(drills: readonly BlockDrill[]): number {
  return drills.reduce((sum, drill) => sum + drill.itemIds.length, 0);
}

/**
 * The day's minutes. A welcome back is lighter, except on a full review: Pedro came back on his
 * class test's eve after five days away, and a light day asked 5 questions on 3 of his 11 topics.
 */
function getSessionBudget(input: SessionBuildInput): number {
  const light = input.freshStart === "welcomeBack" && !isFullReviewDay(input);
  const day = light ? getLightMinutes(input.dailyMinutes) : input.dailyMinutes;

  const minutes = Math.max(0, day - (input.usedMinutes ?? 0));

  return Math.min(minutes, input.remainingLimitMinutes ?? minutes);
}

export function toLessonBlock(lesson: PlannedLesson, reinforcement: boolean): PlannedBlock {
  return {
    canDo: lesson.canDo,
    estimatedMinutes: toMinutes(lesson.minutes),
    kind: "learn",
    lessonId: lesson.lessonId,
    payload: toBlockPayload({
      chapterId: lesson.chapterId,
      planItemId: lesson.planItemId,
      planItemKey: lesson.planItemKey ?? null,
      planSkillId: lesson.planSkillId,
      reinforcement,
      skillIds: lesson.skillIds,
      title: lesson.title,
    }),
  };
}

/**
 * New lessons in plan order while they fit. The next lesson is always offered when there's some
 * room, even if it runs a little long, except under the learner's daily limit, which is never
 * exceeded.
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
  fullReviewSkillIds,
  minutes,
  netScored,
  planItemId,
  planItemKey,
  practice,
  reviewedSkillIds,
}: {
  drills: readonly BlockDrill[];
  fullReviewSkillIds: readonly string[] | null | undefined;
  minutes: number;
  netScored: boolean;
  planItemId: string | null;
  planItemKey: string | null | undefined;
  practice: readonly PracticeItem[];
  /**
   * The skills the day's quick review asks before it: the day asks them too, so a full review
   * needs only the rest (the review may hold a skill's last unseen questions).
   */
  reviewedSkillIds: readonly string[];
}): PlannedBlock | null {
  const drillItems = countDrilled(drills);
  const room = Math.floor(minutes / PRACTICE_MINUTES_PER_QUESTION) - drillItems;
  const items = takePracticeQuestions({ practice, room: Math.max(0, room) });
  const questions = drillItems + items.length;
  const practiceMinutes = questions * PRACTICE_MINUTES_PER_QUESTION;
  const skillIds = [...new Set(items.map((item) => item.skillId))];

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
      fullReview: isFullReview({
        fullReviewSkillIds,
        skillIds: [...skillIds, ...reviewedSkillIds],
      }),
      itemIds: items.map((item) => item.itemId),
      netScored,
      planItemId,
      planItemKey: planItemKey ?? null,
      skillIds,
    }),
  };
}

/** The easy start: a few placement questions in the first week, then today's capsules. */
function buildReviewBlock({
  capsules,
  input: { placementItemIds, weakestReview = false },
}: {
  capsules: readonly BlockCapsule[];
  input: Pick<SessionBuildInput, "placementItemIds" | "weakestReview">;
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
      weakest: weakestReview,
    }),
  };
}

/**
 * The review of a day nothing else fills (no lesson, no practice question: a free exam plan past
 * its first days, say): its due capsules take the time the day's other blocks leave, not just the
 * review's share, so a big study day's lessons don't wait a week to come back. The daily review
 * cap still holds (the capsules come under it). A review of the weakest topics stays brief.
 */
function fillReview({
  blocks,
  budget,
  input,
}: {
  blocks: readonly PlannedBlock[];
  budget: number;
  input: SessionBuildInput;
}): PlannedBlock[] {
  const others = blocks.filter((block) => block.kind !== "review");
  const left = budget - others.reduce((sum, block) => sum + block.estimatedMinutes, 0);

  const fillsDay =
    !input.weakestReview &&
    !others.some((block) => block.kind === "learn" || block.payload.itemIds.length > 0);

  const review =
    fillsDay &&
    buildReviewBlock({
      capsules: takeReviewCapsules({
        capsules: input.capsules,
        room: Math.floor(left / MINUTES_PER_REVIEW) - input.placementItemIds.length,
      }),
      input,
    });

  return blocks.map((block) => (review && block.kind === "review" ? review : block));
}

/** A day the plan gives to reviews and practice: a review day, or a full review for a mock's. */
function isReviewDay(input: SessionBuildInput): boolean {
  return Boolean(input.reviewPlanItemId || input.reviewPlanItemKey) || isFullReviewDay(input);
}

/**
 * New lessons wait on a review day and after a free exam trial; on a first duel's day, only the
 * plan's lessons around it come (see `keepDuelLessons`).
 */
function getNewLessons(input: SessionBuildInput): readonly PlannedLesson[] {
  return input.examTrialEnded || isReviewDay(input) ? [] : keepDuelLessons(input);
}

/**
 * The minutes mixed practice takes from what's left of the day: its share (in the rest of a day
 * underway, its share of the whole day as it opened), at most what its questions fill, so a day
 * with few questions to practice (the first one) gives lessons the rest instead of coming up short.
 */
function getPracticeMinutes({
  budget,
  input,
  remaining,
}: {
  budget: number;
  input: SessionBuildInput;
  remaining: number;
}): number {
  const share = isReviewDay(input) ? 1 : input.practiceShare;
  const practice = input.examTrialEnded ? [] : input.practice;
  const drilled = countDrilled(input.drills);
  const opened = input.openedPractice;

  // Multiplied before dividing, so a day that keeps its minutes gets its practice's exactly.
  const target = opened
    ? (opened.minutes * (budget + (input.usedMinutes ?? 0))) / opened.dayMinutes
    : remaining * share;

  return Math.min(target, (practice.length + drilled) * PRACTICE_MINUTES_PER_QUESTION);
}

/**
 * Builds one day's session in the session shape: an easy start (capsules), the hard part in the
 * middle (new lessons, then mixed practice with mistake drills first), and the checkpoints last,
 * but for the lessons the plan has after a first duel on its day, which follow it. It fits the day's minutes: reviews take their share, checkpoints take what they need, mixed
 * practice gets its growing share (as far as it has questions), and lessons fill the rest in plan
 * order. A welcome back is lighter, a full review asks every skill whatever the day's time, and
 * the learner's daily limit caps it.
 */
export function buildSessionBlocks(input: SessionBuildInput): {
  blocks: PlannedBlock[];
  plannedMinutes: number;
} {
  const budget = getSessionBudget(input);

  if (budget < MIN_BLOCK_MINUTES) {
    return { blocks: [], plannedMinutes: 0 };
  }

  const reviewFactor = input.freshStart ? FRESH_START_REVIEW_FACTOR : 1;
  const checkpoints = input.examTrialEnded ? [] : input.checkpoints;
  const checkpointMinutes = checkpoints.reduce((total, entry) => total + entry.minutes, 0);

  // The checkpoints' time is the day's first: reviews take their share of what they leave.
  const capsules = takeReviewCapsules({
    capsules: input.capsules,
    maxQuestions: Math.floor((budget * REVIEW_SHARE_OF_DAY * reviewFactor) / MINUTES_PER_REVIEW),
    room:
      Math.floor((budget - checkpointMinutes) / MINUTES_PER_REVIEW) - input.placementItemIds.length,
  });

  const review = buildReviewBlock({ capsules, input });

  const base = (review?.estimatedMinutes ?? 0) + checkpointMinutes;

  const produce = toProduceBlock({
    ...input,
    minBlockMinutes: MIN_BLOCK_MINUTES,
    room: budget - base,
  });

  const open = Math.max(0, budget - base - (produce?.estimatedMinutes ?? 0));

  // A full review takes what asking every skill once needs, except under the learner's daily
  // limit, which is never exceeded.
  const fullReviewMinutes =
    countFullReviewQuestions({
      drilled: countDrilled(input.drills),
      fullReviewSkillIds: input.fullReviewSkillIds,
      practice: input.practice,
      reviewedSkillIds: review?.payload.skillIds ?? [],
    }) * PRACTICE_MINUTES_PER_QUESTION;

  const remaining = input.remainingLimitMinutes === null ? Math.max(open, fullReviewMinutes) : open;

  const reinforcement = input.examTrialEnded ? [] : input.reinforcement;

  const learnBudget =
    remaining - getPracticeMinutes({ budget, input, remaining }) - getLessonMinutes(reinforcement);

  const lessons = takeLessons({
    budget: learnBudget,
    canOverflow: input.remainingLimitMinutes === null,
    lessons: getNewLessons(input),
  });

  const learnMinutes = getLessonMinutes([...reinforcement, ...lessons]);
  const { after, before } = splitAtDuel(lessons);

  const built = [
    review,
    ...reinforcement.map((lesson) => toLessonBlock(lesson, true)),
    ...before.map((lesson) => toLessonBlock(lesson, false)),
    buildPracticeBlock({
      drills: input.drills,
      fullReviewSkillIds: input.fullReviewSkillIds,
      minutes: Math.max(0, remaining - learnMinutes),
      netScored: input.netScored,
      planItemId: input.reviewPlanItemId,
      planItemKey: input.reviewPlanItemKey,
      practice: input.examTrialEnded ? [] : input.practice,
      reviewedSkillIds: review?.payload.skillIds ?? [],
    }),
    produce,
    ...checkpoints.map((checkpoint) => buildCheckpointBlock(checkpoint)),
    ...after.map((lesson) => toLessonBlock(lesson, false)),
  ].filter((block) => block !== null);

  const blocks = fillReview({ blocks: built, budget, input });

  return { blocks, plannedMinutes: blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0) };
}
