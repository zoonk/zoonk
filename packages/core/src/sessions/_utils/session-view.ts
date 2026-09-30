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
import { type WeekDay, getSessionBlockMinutes } from "../daily-goal";
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
   * Practice scored net, as in exams where a wrong answer cancels a right one: statements can be
   * left blank. Swipe capsules are scored net on their own.
   */
  netScored: boolean;
  /** An exam's topic the board asks a lot, from past papers: tiles tag it "Often tested". */
  oftenTested: boolean;
  planItemId: string | null;
  questions: number;
  reinforcement: boolean;
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

export function toStudyBlockView({
  answeredItemIds,
  block,
  oftenTestedSkillIds = NO_SKILLS,
}: {
  answeredItemIds: ReadonlySet<string>;
  block: StudySessionBlock;
  /** The exam goal's skills its board asks a lot; empty for other goals. */
  oftenTestedSkillIds?: ReadonlySet<string>;
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
    title: payload.title ?? payload.capsules[0]?.title ?? null,
  };
}

export type StudySessionView = {
  blocks: StudyBlockView[];
  /** Brain Power earned so far in this session, full meal included. */
  brainPower: number;
  dailyLimit: DailyTimeLimitStatus | null;
  examAccess: ExamPrepAccess;
  extraTime: ExtraTime;
  freshStart: StudySessionRow["freshStart"];
  fullMeal: { bonus: number; earned: boolean; ready: boolean };
  goalId: string | null;
  /** Right answers in a row on new or due material; Fun shows it, Focus counts it. */
  hyperdrive: { level: number; streak: number };
  id: string;
  localDate: Date;
  /** "18 of 45 min": minutes of finished blocks, today's blocks and what the plan gives the day. */
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

/** The session view model both modes read: Focus as a card, Fun as the flight plan. */
export function toStudySessionView({
  answers,
  dailyLimit,
  dayMinutes,
  examAccess,
  missions,
  oftenTestedSkillIds,
  session,
  week,
}: {
  answers: readonly SessionAnswer[];
  dailyLimit: DailyTimeLimitStatus | null;
  /** The minutes the goal's plan gives the session's day. */
  dayMinutes: number;
  examAccess: ExamPrepAccess;
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
  const blocksPower = session.blocks.reduce((sum, block) => sum + block.brainPower, 0);

  return {
    blocks: session.blocks.map((block) =>
      toStudyBlockView({ answeredItemIds, block, oftenTestedSkillIds }),
    ),
    brainPower: blocksPower + (fullMealEarned ? BRAIN_POWER_BONUS.fullMeal : 0),
    dailyLimit,
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
    localDate: session.localDate,
    minutes: {
      dailyGoal: dayMinutes,
      done: Math.round(getSessionBlockMinutes(session.blocks)),
      planned: session.plannedMinutes,
    },
    missions,
    nextBlockId: getNextBlockId(session.blocks),
    pauseSuggested: shouldSuggestPause(answers.map((answer) => answer.isCorrect)),
    sessionBar: getSessionBar(session.blocks),
    status: session.status,
    week: {
      days: week,
      daysHitGoal: week.filter((day) => day.hitGoal).length,
      studyDays: week.filter((day) => day.goalMinutes > 0).length,
    },
  };
}
