import { type StudySessionBlock } from "@zoonk/db";
import { type DailyTimeLimitStatus } from "../../minors/get-daily-time-limit";
import { type BlockCheckpoint, getBlockItemIds, readBlockPayload } from "../block-payload";
import {
  BRAIN_POWER_BONUS,
  type BlockOutcome,
  EMPTY_OUTCOME,
  estimateBrainPower,
  getHyperdriveLevel,
  scoreAnswers,
} from "../brain-power";
import { type CapsuleFormat } from "../capsules";
import { type WeekDay, getSessionMinutesDone } from "../daily-goal";
import { type ExtraTime, getExtraTime } from "../extra-time";
import { type Mission, isFullMeal } from "../missions";
import { shouldSuggestPause } from "../pause-suggestion";
import { type ExamPrepAccess } from "./exam-access";
import { type SessionAnswer } from "./session-answers";
import { type StudySessionRow } from "./study-session-access";

/** A short lesson has about one question for every two minutes. */
const LESSON_QUESTIONS_PER_MINUTE = 0.5;

type CapsuleView = {
  format: CapsuleFormat;
  key: string;
  lessonId: string | null;
  opened: boolean;
  questions: number;
  title: string;
};

export type StudyBlockView = Pick<
  StudySessionBlock,
  "brainPower" | "canDo" | "id" | "kind" | "lessonId" | "position" | "status"
> & {
  answered: number;
  capsules: CapsuleView[];
  chapterId: string | null;
  checkpoint: BlockCheckpoint | null;
  estimatedBrainPower: number;
  estimatedMinutes: number;
  extra: boolean;
  /**
   * Practice on every topic of the test, weakest first, on a day whose mock the learner's plan
   * doesn't include: it counts as their test in real conditions.
   */
  fullReview: boolean;
  /**
   * Practice scored net, as in exams where a wrong answer cancels a right one: statements can be
   * left blank. Swipe capsules are scored net on their own.
   */
  netScored: boolean;
  /** An exam's topic the board asks a lot, from past papers: tiles tag it "Often tested". */
  oftenTested: boolean;
  planItemId: string | null;
  questions: number;
  reinforcement: boolean;
  /**
   * The goal's subject the block studies ("Língua Portuguesa"), by its short name: Today labels
   * lessons with it. Null for blocks that mix subjects, and for goals with fewer than two.
   */
  subject: string | null;
  title: string | null;
};

function getEstimateOutcome(block: StudySessionBlock): {
  outcome: BlockOutcome;
  questions: number;
} {
  const payload = readBlockPayload(block);
  const questions = getBlockItemIds(payload).length;

  if (block.kind === "learn") {
    const minutes = block.estimatedMinutes ?? 0;

    return {
      outcome: { ...EMPTY_OUTCOME, firstLessonCompletion: true },
      questions: Math.round(minutes * LESSON_QUESTIONS_PER_MINUTE),
    };
  }

  const checkpoint = payload.checkpoint ? { kind: payload.checkpoint.kind, passed: true } : null;

  return {
    outcome: { ...EMPTY_OUTCOME, capsulesOpened: payload.capsules.length, checkpoint },
    questions,
  };
}

const NO_SKILLS: ReadonlySet<string> = new Set();
const NO_SUBJECTS: ReadonlyMap<string, string> = new Map();

export function toStudyBlockView({
  answeredItemIds,
  block,
  oftenTestedSkillIds = NO_SKILLS,
  subject = null,
}: {
  answeredItemIds: ReadonlySet<string>;
  block: StudySessionBlock;
  /** The exam goal's skills its board asks a lot; empty for other goals. */
  oftenTestedSkillIds?: ReadonlySet<string>;
  /** The goal's subject the block studies, by its short name; null without one. */
  subject?: string | null;
}): StudyBlockView {
  const payload = readBlockPayload(block);
  const itemIds = getBlockItemIds(payload);
  const teaches = block.kind === "learn" || block.kind === "practice" || block.kind === "produce";

  return {
    answered: itemIds.filter((id) => answeredItemIds.has(id)).length,
    brainPower: block.brainPower,
    canDo: block.canDo,
    capsules: payload.capsules.map((capsule) => ({
      format: capsule.format,
      key: capsule.key,
      lessonId: capsule.lessonId,
      opened: capsule.itemIds.some((id) => answeredItemIds.has(id)),
      questions: capsule.itemIds.length,
      title: capsule.title,
    })),
    chapterId: payload.chapterId,
    checkpoint: payload.checkpoint,
    estimatedBrainPower: estimateBrainPower(getEstimateOutcome(block)),
    estimatedMinutes: block.estimatedMinutes ?? 0,
    extra: payload.extra,
    fullReview: payload.fullReview,
    id: block.id,
    kind: block.kind,
    lessonId: block.lessonId,
    netScored: payload.netScored,
    oftenTested: teaches && payload.skillIds.some((skillId) => oftenTestedSkillIds.has(skillId)),
    planItemId: payload.planItemId,
    position: block.position,
    questions: itemIds.length,
    reinforcement: payload.reinforcement,
    status: block.status,
    subject,
    title: payload.title ?? payload.capsules[0]?.title ?? null,
  };
}

export type EmptyDay = "lessonsComing" | "nothingNew";

/**
 * Where catching up stands on a day: the day's blocks that catch up (lessons earlier days left,
 * which the day opens with), how many such lessons are left in all, and the ones the day's normal
 * time doesn't fit, with how long they take: the learner can add them to today with one tap, or
 * they come first on the next days.
 */
export type CatchUpView = {
  blockIds: string[];
  later: { lessons: number; minutes: number };
  lessonsLeft: number;
};

export type StudySessionView = {
  blocks: StudyBlockView[];
  /** Brain Power earned so far in this session, full meal included. */
  brainPower: number;
  /**
   * Catching up on lessons earlier days left (see `CatchUpView`); null when the learner is on
   * pace, and in a session's summary.
   */
  catchUp: CatchUpView | null;
  /**
   * Whether this is the learner's day now: today's session, or the day before's they're still in
   * after midnight. An earlier day's session has nothing left to open; its next step is the new day.
   */
  current: boolean;
  dailyLimit: DailyTimeLimitStatus | null;
  /**
   * Why a day with study time has no blocks: its lessons are still being outlined
   * (`lessonsComing`, the day fills in on its own), or the plan has no new lesson left for it
   * (`nothingNew`: every lesson is done or one the learner showed they know), so the day offers
   * what's still useful instead. Null when the day has blocks or no study time.
   */
  emptyDay: EmptyDay | null;
  examAccess: ExamPrepAccess;
  extraTime: ExtraTime;
  freshStart: StudySessionRow["freshStart"];
  /**
   * The day has blocks and holds time for more lessons still being outlined: they join its end on
   * their own once they land (read it again), so the learner hears more is coming instead of the
   * day growing unannounced. False otherwise, and on a day without blocks (`emptyDay` says why).
   */
  lessonsComing: boolean;
  fullMeal: { bonus: number; earned: boolean; ready: boolean };
  goalId: string | null;
  /** Right answers in a row on new or due material. */
  hyperdrive: { level: number; streak: number };
  id: string;
  localDate: Date;
  /**
   * "18 of 45 min": the planned minutes of the blocks finished (see `getSessionMinutesDone`),
   * today's blocks and what the plan gives the day.
   */
  minutes: { dailyGoal: number; done: number; planned: number };
  missions: Mission[];
  nextBlockId: string | null;
  pauseSuggested: boolean;
  sessionBar: { completed: number; total: number };
  status: StudySessionRow["status"];
  week: { days: WeekDay[]; daysHitGoal: number; studyDays: number };
};

/**
 * The session bar: one step per block still in the day (skipped ones leave it), filled as they're
 * done. Lessons show it in the player; the session and Today show it too.
 */
export function getSessionBar(blocks: readonly Pick<StudySessionBlock, "status">[]) {
  return {
    completed: blocks.filter((block) => block.status === "completed").length,
    total: blocks.filter((block) => block.status !== "skipped").length,
  };
}

/** The block to go on with: the one in progress, else the first not started. */
export function getNextBlockId(blocks: readonly StudySessionBlock[]): string | null {
  const next =
    blocks.find((block) => block.status === "active") ??
    blocks.find((block) => block.status === "pending");

  return next?.id ?? null;
}

/**
 * Today's day in the week counts at least the session's progress (see `getSessionMinutesDone`),
 * so its ring fills as far as Today's card while the day is the session's.
 */
function withSessionDay({
  current,
  days,
  done,
}: {
  current: boolean;
  days: readonly WeekDay[];
  done: number;
}): WeekDay[] {
  return days.map((day) => {
    if (!current || !day.isToday || done <= day.minutes) {
      return day;
    }

    return {
      ...day,
      hitGoal: day.hitGoal || (day.goalMinutes > 0 && done >= day.goalMinutes),
      minutes: done,
      studied: true,
    };
  });
}

/** The session view model the apps and the API read. */
export function toStudySessionView({
  answers,
  blockSubjects = NO_SUBJECTS,
  current,
  dailyLimit,
  dayMinutes,
  emptyDay = null,
  examAccess,
  lessonsComing = false,
  missions,
  oftenTestedSkillIds,
  session,
  week,
}: {
  answers: readonly SessionAnswer[];
  /** Each block's subject by its short name, by block id, for the blocks' labels. */
  blockSubjects?: ReadonlyMap<string, string>;
  current: boolean;
  dailyLimit: DailyTimeLimitStatus | null;
  /** The minutes the goal's plan gives the session's day. */
  dayMinutes: number;
  /** Why the day has no blocks, when it has study time but none (see `StudySessionView`). */
  emptyDay?: EmptyDay | null;
  examAccess: ExamPrepAccess;
  /** The day holds time for lessons still being outlined (see `StudySessionView`). */
  lessonsComing?: boolean;
  missions: Mission[];
  /** The exam goal's skills its board asks a lot; empty for other goals. */
  oftenTestedSkillIds?: ReadonlySet<string>;
  session: StudySessionRow;
  week: WeekDay[];
}): StudySessionView {
  const answeredItemIds = new Set(
    answers.flatMap((answer) => (answer.itemId ? [answer.itemId] : [])),
  );

  const streak = scoreAnswers({ answers }).streak;
  const fullMealEarned = session.fullMealAt !== null;
  const minutesDone = Math.round(getSessionMinutesDone(session.blocks));
  const days = withSessionDay({ current, days: week, done: minutesDone });
  const blocksPower = session.blocks.reduce((sum, block) => sum + block.brainPower, 0);

  return {
    blocks: session.blocks.map((block) =>
      toStudyBlockView({
        answeredItemIds,
        block,
        oftenTestedSkillIds,
        subject: blockSubjects.get(block.id) ?? null,
      }),
    ),
    brainPower: blocksPower + (fullMealEarned ? BRAIN_POWER_BONUS.fullMeal : 0),
    catchUp: null,
    current,
    dailyLimit,
    emptyDay: session.blocks.length === 0 && dayMinutes > 0 ? emptyDay : null,
    examAccess,
    extraTime: getExtraTime({
      blocks: session.blocks.map((block) => ({
        extra: readBlockPayload(block).extra,
        status: block.status,
      })),
      remainingLimitMinutes: dailyLimit?.remainingMinutes ?? null,
    }),
    freshStart: session.freshStart,
    fullMeal: {
      bonus: BRAIN_POWER_BONUS.fullMeal,
      earned: fullMealEarned,
      ready: isFullMeal(missions),
    },
    goalId: session.goalId,
    hyperdrive: { level: getHyperdriveLevel(streak), streak },
    id: session.id,
    lessonsComing: lessonsComing && session.blocks.length > 0,
    localDate: session.localDate,
    minutes: { dailyGoal: dayMinutes, done: minutesDone, planned: session.plannedMinutes },
    missions,
    nextBlockId: getNextBlockId(session.blocks),
    pauseSuggested: shouldSuggestPause(answers.map((answer) => answer.isCorrect)),
    sessionBar: getSessionBar(session.blocks),
    status: session.status,
    week: {
      days,
      daysHitGoal: days.filter((day) => day.hitGoal).length,
      studyDays: days.filter((day) => day.goalMinutes > 0).length,
    },
  };
}
