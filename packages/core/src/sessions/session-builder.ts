import { type StudyFreshStart, type StudySessionBlock } from "@zoonk/db";
import { type ChallengeReachItem, isPhaseChallenge } from "../checkpoints/_utils/challenge-reach";
import { type PlannedProduce, toProduceBlock } from "../exams/essays/produce-block";
import { MINUTES_PER_REVIEW, REVIEW_SHARE_OF_DAY } from "../learner/review-load";
import {
  fundLeadingChallenges,
  getLeadingChallenges,
  listDayStretch,
  placePutOffChallenges,
} from "./_utils/day-stretch";
import { fillRemainingLessonTime } from "./_utils/fill-session-time";
import { canHoldPhaseChallenges } from "./_utils/phase-challenge-day";
import { buildCheckpointBlock } from "./_utils/planned-checkpoint-block";
import { type PracticeTopic, buildPracticeBlocks } from "./_utils/practice-blocks";
import {
  getLessonMinutes,
  getNewLessons,
  isSessionReviewDay,
  takeLessons,
  toLessonBlock,
} from "./_utils/session-lessons";
import { MIN_BLOCK_MINUTES, PRACTICE_MINUTES_PER_QUESTION, toMinutes } from "./block-minutes";
import {
  type BlockCapsule,
  type BlockCheckpoint,
  type BlockPayload,
  toBlockPayload,
} from "./block-payload";
import { takeReviewCapsules } from "./capsules";
import { getSessionDayMinutes } from "./fresh-start";
import { countFullReviewQuestions } from "./full-review";

/** Fresh starts reduce review backlog rather than carrying missed reviews into the new day. */
const FRESH_START_REVIEW_FACTOR = 0.5;

export type PlannedLesson = {
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
  afterLessons?: boolean;
  itemIds: string[];
  minutes: number;
  planItemId: string | null;
  planItemKey?: string | null;
  skillIds: string[];
  title: string;
  reinforcement?: PlannedLesson[];
};

/** Supply weakest skills first and contiguous stimulus sets; sets must be asked whole. */
export type PracticeItem = { itemId: string; setId?: string; skillId: string };

export type SessionBuildInput = {
  /** Today's due capsules, most urgent first, with their questions picked. */
  capsules: BlockCapsule[];
  /** Earlier phases first; a day may carry more than one challenge. */
  checkpoints: PlannedCheckpoint[];
  planItems?: readonly ChallengeReachItem[];
  /** Whether the learner started each phase challenge of their last session (`getSessionChallenges`). */
  lastSessionChallenges?: ReadonlyMap<string, boolean>;
  dailyMinutes: number;
  /** A free exam plan past its first days: reviews and fixes stay, new work waits for Plus. */
  examTrialEnded: boolean;
  /** First-week placement opens before capsules. */
  placementItemIds: string[];
  freshStart: StudyFreshStart | null;
  lessons: PlannedLesson[];
  fillLessons?: PlannedLesson[];
  mockReplacesDay?: boolean;
  /** An exam where a wrong answer cancels a right one: mixed practice is scored net. */
  netScored: boolean;
  practice: PracticeItem[];
  /** Official-rubric essay; null when none is planned today. */
  produce: PlannedProduce | null;
  practiceShare: number;
  /** Replaces an unavailable mock with practice across every goal skill; null on other days. */
  fullReviewSkillIds?: readonly string[] | null;
  /** A scheduled review day permits no new lessons. */
  reviewPlanItemId: string | null;
  /** A selected review is identified before Open assigns its persisted row ID. */
  reviewPlanItemKey?: string | null;
  /** Reviews weak studied topics when nothing is due and no other work remains. */
  weakestReview?: boolean;
  /** Today's minutes for lessons someone is still writing: practice and review leave them free so those lessons fit once written. */
  writingMinutes?: number;
  /** Each practice topic's name and area as the plan shows them (`getPlanTopics`). */
  topics: ReadonlyMap<string, PracticeTopic>;
  /** Minutes held by preserved blocks; rebuilding fills only the remaining time. */
  usedMinutes?: number;
  /** Preserve practice's share of the original whole day, rather than its share of the remaining time. */
  openedPractice?: { dayMinutes: number; minutes: number };
};

export type PlannedBlock = Pick<StudySessionBlock, "canDo" | "kind" | "lessonId"> & {
  estimatedMinutes: number;
  payload: BlockPayload;
};

/** Full reviews stay whole on returns so the exam-eve session still reaches every topic. */
function getSessionBudget(input: SessionBuildInput): number {
  return Math.max(0, getSessionDayMinutes(input) - (input.usedMinutes ?? 0));
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

/** Review-only days use remaining time rather than a fixed share; weakest-topic reviews stay brief. */
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

  const left =
    budget -
    (input.writingMinutes ?? 0) -
    others.reduce((sum, block) => sum + block.estimatedMinutes, 0);

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
  const share = isSessionReviewDay(input) ? 1 : input.practiceShare;
  const practice = input.examTrialEnded ? [] : input.practice;
  const opened = input.openedPractice;

  // Multiplied before dividing, so a day that keeps its minutes gets its practice's exactly.
  const target = opened
    ? (opened.minutes * (budget + (input.usedMinutes ?? 0))) / opened.dayMinutes
    : remaining * share;

  return Math.min(target, practice.length * PRACTICE_MINUTES_PER_QUESTION);
}

function fundSessionChallenges(input: SessionBuildInput, budget: number) {
  const planItems = input.planItems ?? [];

  const available = canHoldPhaseChallenges({
    mockOnlyDay: input.mockReplacesDay ?? false,
    reviewDay: isSessionReviewDay(input),
    trialEnded: input.examTrialEnded,
  })
    ? input.checkpoints.filter((checkpoint) => isPhaseChallenge(checkpoint))
    : [];

  const leading = fundLeadingChallenges({
    budget,
    checkpoints: getLeadingChallenges({ checkpoints: available, items: planItems }),
    overflow: !input.usedMinutes,
  });

  const calendar = input.examTrialEnded
    ? []
    : input.checkpoints.filter((checkpoint) => !isPhaseChallenge(checkpoint));

  return { available, calendar, checkpoints: [...leading, ...calendar], leading, planItems };
}

/** Full reviews cover every skill and welcome-back days otherwise stay lighter. */
export function buildSessionBlocks(day: SessionBuildInput): {
  blocks: PlannedBlock[];
  plannedMinutes: number;
} {
  const input = {
    ...day,
    checkpoints: placePutOffChallenges({
      checkpoints: day.checkpoints,
      hasLessons: day.lessons.length + (day.fillLessons?.length ?? 0) > 0,
      lastSession: day.lastSessionChallenges,
    }),
  };

  const budget = getSessionBudget(input);

  if (budget < MIN_BLOCK_MINUTES) {
    return { blocks: [], plannedMinutes: 0 };
  }

  const reviewFactor = input.freshStart ? FRESH_START_REVIEW_FACTOR : 1;

  const { available, calendar, checkpoints, leading, planItems } = fundSessionChallenges(
    input,
    budget,
  );

  if (leading[0] && leading[0].minutes > budget) {
    return {
      blocks: [buildCheckpointBlock(leading[0])],
      plannedMinutes: Math.ceil(leading[0].minutes),
    };
  }

  const checkpointMinutes = checkpoints.reduce((total, entry) => total + entry.minutes, 0);

  // Checkpoint funding takes priority over the review share.
  const reviewInput = {
    ...input,
    placementItemIds: input.placementItemIds.slice(
      0,
      Math.max(0, Math.floor((budget - checkpointMinutes) / MINUTES_PER_REVIEW)),
    ),
  };

  const capsules = takeReviewCapsules({
    capsules: input.capsules,
    maxQuestions: Math.floor((budget * REVIEW_SHARE_OF_DAY * reviewFactor) / MINUTES_PER_REVIEW),
    room:
      Math.floor((budget - checkpointMinutes) / MINUTES_PER_REVIEW) -
      reviewInput.placementItemIds.length,
  });

  const review = buildReviewBlock({ capsules, input: reviewInput });

  const base = (review?.estimatedMinutes ?? 0) + checkpointMinutes;

  const produce = toProduceBlock({
    ...input,
    minBlockMinutes: MIN_BLOCK_MINUTES,
    room: budget - base,
  });

  const open = Math.max(0, budget - base - (produce?.estimatedMinutes ?? 0));

  const fullReviewMinutes =
    countFullReviewQuestions({
      fullReviewSkillIds: input.fullReviewSkillIds,
      practice: input.practice,
      reviewedSkillIds: review?.payload.skillIds ?? [],
    }) * PRACTICE_MINUTES_PER_QUESTION;

  const remaining = Math.max(open, fullReviewMinutes);

  const reinforcement = input.examTrialEnded
    ? []
    : takeLessons({
        budget: remaining,
        lessons: leading.flatMap((checkpoint) => checkpoint.reinforcement ?? []),
        overflow: false,
      });

  const learnBudget =
    remaining - getPracticeMinutes({ budget, input, remaining }) - getLessonMinutes(reinforcement);

  const stretch = listDayStretch({
    budget: learnBudget + leading.reduce((sum, checkpoint) => sum + checkpoint.minutes, 0),
    checkpoints: available,
    items: planItems,
    leading,
    lessons: getNewLessons(input),
    overflow: !input.usedMinutes,
  });

  const lessons = stretch.flatMap((entry) => (entry.kind === "lesson" ? [entry.lesson] : []));

  const stretchMinutes = stretch.reduce(
    (sum, entry) =>
      sum + (entry.kind === "lesson" ? entry.lesson.minutes : entry.checkpoint.minutes),
    0,
  );

  const learnMinutes =
    getLessonMinutes(reinforcement) +
    stretchMinutes -
    leading.reduce((sum, checkpoint) => sum + checkpoint.minutes, 0);

  const built = [
    review,
    ...reinforcement.map((lesson) => toLessonBlock(lesson, true)),
    ...stretch.map((entry) =>
      entry.kind === "lesson"
        ? toLessonBlock(entry.lesson, false)
        : buildCheckpointBlock(entry.checkpoint),
    ),
    ...buildPracticeBlocks({
      fullReviewSkillIds: input.fullReviewSkillIds,
      minutes: Math.max(0, remaining - learnMinutes - (input.writingMinutes ?? 0)),
      netScored: input.netScored,
      planItemId: input.reviewPlanItemId,
      planItemKey: input.reviewPlanItemKey,
      practice: input.examTrialEnded ? [] : input.practice,
      reviewedSkillIds: review?.payload.skillIds ?? [],
      topics: input.topics,
    }),
    produce,
    ...calendar.map((checkpoint) => buildCheckpointBlock(checkpoint)),
  ].filter((block) => block !== null);

  return fillRemainingLessonTime({
    available,
    blocks: fillReview({ blocks: built, budget, input: reviewInput }),
    budget,
    checkpointMinutes,
    input,
    leading,
    learnBudget,
    lessons,
    produceMinutes: produce?.estimatedMinutes ?? 0,
  });
}
