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

/** Exam-format reading and working takes longer than quick reviews. */
export const PRACTICE_MINUTES_PER_QUESTION = 1.5;

/** Shorter than this, a block isn't worth a stop of its own. */
export const MIN_BLOCK_MINUTES = 3;

/** Fresh starts reduce review backlog rather than carrying missed reviews into the new day. */
const FRESH_START_REVIEW_FACTOR = 0.5;

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

/** Supply weakest skills first and contiguous stimulus sets; sets must be asked whole. */
export type PracticeItem = { itemId: string; setId?: string; skillId: string };

export type SessionBuildInput = {
  /** Today's due capsules, most urgent first, with their questions picked. */
  capsules: BlockCapsule[];
  /** Earlier phases first; a day may carry more than one challenge. */
  checkpoints: PlannedCheckpoint[];
  dailyMinutes: number;
  /** Oldest open mistakes from earlier days only. */
  drills: BlockDrill[];
  /** A free exam plan past its first days: reviews and fixes stay, new work waits for Plus. */
  examTrialEnded: boolean;
  /** First-week placement opens before capsules. */
  placementItemIds: string[];
  freshStart: StudyFreshStart | null;
  lessons: PlannedLesson[];
  /** An exam where a wrong answer cancels a right one: mixed practice is scored net. */
  netScored: boolean;
  practice: PracticeItem[];
  /** Official-rubric essay; null when none is planned today. */
  produce: PlannedProduce | null;
  practiceShare: number;
  /** Up to two available lessons before a boss rematch. */
  reinforcement: PlannedLesson[];
  /** Replaces an unavailable mock with practice across every goal skill; null on other days. */
  fullReviewSkillIds?: readonly string[] | null;
  /** A scheduled review day permits no new lessons. */
  reviewPlanItemId: string | null;
  /** A selected review is identified before Open assigns its persisted row ID. */
  reviewPlanItemKey?: string | null;
  /** Reviews weak studied topics when nothing is due and no other work remains. */
  weakestReview?: boolean;
  /** Minutes left under the learner's daily limit, or null without one. */
  remainingLimitMinutes: number | null;
  /** Minutes held by preserved blocks; rebuilding fills only the remaining time. */
  usedMinutes?: number;
  /** Preserve practice's share of the original whole day, rather than its share of the remaining time. */
  openedPractice?: { dayMinutes: number; minutes: number };
};

export type PlannedBlock = Pick<StudySessionBlock, "canDo" | "kind" | "lessonId"> & {
  estimatedMinutes: number;
  payload: BlockPayload;
};

function toMinutes(value: number): number {
  return Math.max(1, Math.round(value));
}

function countDrilled(drills: readonly BlockDrill[]): number {
  return drills.reduce((sum, drill) => sum + drill.itemIds.length, 0);
}

/** Full reviews stay whole on returns so the exam-eve session still reaches every topic. */
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

/** The first lesson may overflow the soft budget, but never the learner's daily limit. */
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
  /** Count quick-review skills toward full coverage, including skills whose last unseen questions they used. */
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

/** Review-only days use remaining time rather than a fixed share, still honoring daily caps; weakest-topic reviews stay brief. */
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

function isReviewDay(input: SessionBuildInput): boolean {
  return Boolean(input.reviewPlanItemId || input.reviewPlanItemKey) || isFullReviewDay(input);
}

/** Review days and expired free trials offer no new lessons; duel days retain only their planned surrounding lessons. */
function getNewLessons(input: SessionBuildInput): readonly PlannedLesson[] {
  return input.examTrialEnded || isReviewDay(input) ? [] : keepDuelLessons(input);
}

/** Preserve the opened day's practice share; unused question capacity returns time to lessons. */
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

/** Builds within daily limits; full reviews cover every skill and welcome-back days otherwise stay lighter. */
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

  // Checkpoint funding takes priority over the review share.
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

  // Full topic coverage may exceed the soft budget, but never the learner's daily limit.
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
