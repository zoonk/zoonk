import { type StudySessionBlock } from "@zoonk/db";
import { getPlannedQuestions } from "../../checkpoints/checkpoint-rules";
import { type StudyWeek } from "../../progress/_utils/load-study-week";
import { type BlockCheckpoint, getBlockItemIds, readBlockPayload } from "../block-payload";
import { getStoredBlockWait } from "../block-wait";
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
import { type DailyTimeLimitStatus } from "../get-daily-time-limit";
import { type Mission, getMissionBonus, isFullMeal } from "../missions";
import { shouldSuggestPause } from "../pause-suggestion";
import { type ExamPrepAccess } from "./exam-access";
import { isExamTomorrow } from "./exam-tomorrow";
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
  /** Whether this lesson's chapter test can be offered after today's test and study history. */
  canTestOut: boolean;
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
   * A practice block that only fixes the learner's mistakes (their drills, no practice questions),
   * as a free exam plan's day is past its first week: named for that, not as mixed practice.
   */
  mistakesOnly: boolean;
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
   * The goal's subject the block studies ("Portuguese Language"), by its short name: Today labels
   * lessons with it. Null for blocks that mix subjects, and for goals with fewer than two.
   */
  subject: string | null;
  title: string | null;
  /** Why this phase challenge must wait for earlier work in this session. */
  waitReason: "challenge" | "lessons" | null;
  /**
   * A review of the weakest studied topics, none of them due: a day with nothing due and nothing
   * else to study gets it instead of staying empty.
   */
  weakest: boolean;
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
  blocks = [block],
  blockedTestOutChapters = NO_SKILLS,
  oftenTestedSkillIds = NO_SKILLS,
  subject = null,
}: {
  answeredItemIds: ReadonlySet<string>;
  block: StudySessionBlock;
  blocks?: readonly StudySessionBlock[];
  blockedTestOutChapters?: ReadonlySet<string>;
  /** The exam goal's skills its board asks a lot; empty for other goals. */
  oftenTestedSkillIds?: ReadonlySet<string>;
  /** The goal's subject the block studies, by its short name; null without one. */
  subject?: string | null;
}): StudyBlockView {
  const payload = readBlockPayload(block);
  const itemIds = getBlockItemIds(payload);
  const teaches = block.kind === "learn" || block.kind === "practice" || block.kind === "produce";

  // A challenge judged by right answers (a language call has no pass mark) that the bank held too
  // few questions for asks its full ten once Start writes them (`getPlannedQuestions`).
  const { checkpoint } = payload;

  const waitsForQuestions =
    checkpoint !== null &&
    !checkpoint.mock &&
    checkpoint.passMark > 0 &&
    block.status === "pending";

  return {
    answered: itemIds.filter((id) => answeredItemIds.has(id)).length,
    brainPower: block.brainPower,
    canDo: block.canDo,
    canTestOut:
      block.kind === "learn" &&
      payload.chapterId !== null &&
      !blockedTestOutChapters.has(payload.chapterId),
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
    mistakesOnly:
      block.kind === "practice" && payload.drills.length > 0 && payload.itemIds.length === 0,
    netScored: payload.netScored,
    oftenTested: teaches && payload.skillIds.some((skillId) => oftenTestedSkillIds.has(skillId)),
    planItemId: payload.planItemId,
    position: block.position,
    questions: waitsForQuestions ? getPlannedQuestions(itemIds.length) : itemIds.length,
    reinforcement: payload.reinforcement,
    status: block.status,
    subject,
    title: payload.title ?? payload.capsules[0]?.title ?? null,
    waitReason: getStoredBlockWait({ block, blocks }),
    weakest: payload.weakest,
  };
}

export type EmptyDay = "lessonsComing" | "nothingNew";

/**
 * Where catching up stands on a day: the day's blocks that catch up (lessons earlier days left,
 * which the day opens with), how many such lessons are left in all, and the ones the day's normal
 * time doesn't fit, with how long they take: they come first on the next days, or, while they
 * take about one more day of the learner's daily time (`offered`), the learner can add them to
 * today with one tap.
 */
export type CatchUpView = {
  blockIds: string[];
  later: { lessons: number; minutes: number; offered: boolean };
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
  /**
   * The goal's exam is tomorrow (see `isExamTomorrow`): nothing of the goal comes back tomorrow,
   * so the day says what it leaves without pointing there.
   */
  examTomorrow: boolean;
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
  week: { days: WeekDay[]; daysHitGoal: number; studyDays: number; time: StudyWeek["time"] };
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
 * The session's day counts at least its progress (see `getSessionMinutesDone`). A session carried
 * across midnight never fills the new day's ring with the previous day's completed blocks.
 */
function withSessionDay({
  current,
  days,
  done,
  localDate,
}: {
  current: boolean;
  days: readonly WeekDay[];
  done: number;
  localDate: Date;
}): WeekDay[] {
  return days.map((day) => {
    if (!current || day.date.getTime() !== localDate.getTime() || done <= day.minutes) {
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
  blockedTestOutChapters = NO_SKILLS,
  current,
  dailyLimit,
  dayMinutes,
  emptyDay = null,
  examAccess,
  lessonsComing = false,
  fullMealEarned,
  missions,
  oftenTestedSkillIds,
  session,
  week,
}: {
  answers: readonly SessionAnswer[];
  /** Each block's subject by its short name, by block id, for the blocks' labels. */
  blockSubjects?: ReadonlyMap<string, string>;
  blockedTestOutChapters?: ReadonlySet<string>;
  current: boolean;
  dailyLimit: DailyTimeLimitStatus | null;
  /** The minutes the goal's plan gives the session's day. */
  dayMinutes: number;
  /** Why the day has no blocks, when it has study time but none (see `StudySessionView`). */
  emptyDay?: EmptyDay | null;
  examAccess: ExamPrepAccess;
  /** The day holds time for lessons still being outlined (see `StudySessionView`). */
  lessonsComing?: boolean;
  fullMealEarned?: boolean;
  missions: Mission[];
  /** The exam goal's skills its board asks a lot; empty for other goals. */
  oftenTestedSkillIds?: ReadonlySet<string>;
  session: StudySessionRow;
  week: StudyWeek;
}): StudySessionView {
  const answeredItemIds = new Set(
    answers.flatMap((answer) => (answer.itemId ? [answer.itemId] : [])),
  );

  const streak = scoreAnswers({ answers }).streak;
  const minutesDone = Math.round(getSessionMinutesDone(session.blocks));

  const days = withSessionDay({
    current,
    days: week.days,
    done: minutesDone,
    localDate: session.localDate,
  });

  const blocksPower = session.blocks.reduce((sum, block) => sum + block.brainPower, 0);

  return {
    blocks: session.blocks.map((block) =>
      toStudyBlockView({
        answeredItemIds,
        block,
        blockedTestOutChapters,
        blocks: session.blocks,
        oftenTestedSkillIds,
        subject: blockSubjects.get(block.id) ?? null,
      }),
    ),
    brainPower: blocksPower + (session.fullMealAt === null ? 0 : BRAIN_POWER_BONUS.fullMeal),
    catchUp: null,
    current,
    dailyLimit,
    emptyDay: session.blocks.length === 0 && dayMinutes > 0 ? emptyDay : null,
    examAccess,
    examTomorrow: isExamTomorrow({ day: session.localDate, goal: session.goal }),
    extraTime: getExtraTime({
      blocks: session.blocks.map((block) => ({
        extra: readBlockPayload(block).extra,
        status: block.status,
      })),
      remainingLimitMinutes: dailyLimit?.remainingMinutes ?? null,
    }),
    freshStart: session.freshStart,
    fullMeal: {
      bonus: getMissionBonus(missions),
      earned: fullMealEarned ?? session.fullMealAt !== null,
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
      time: week.time,
    },
  };
}
