import { prisma } from "@zoonk/db";
import "server-only";
import { withoutLockedPhaseChallenges } from "../../checkpoints/_utils/phase-challenge-access";
import { getAllowance } from "../../entitlements/get-allowance";
import { loadOftenTestedSkillIds } from "../../exams/map/load-often-tested";
import { loadBlockedTestOutChapters } from "../../learner/test-out/_utils/offer-eligibility";
import { DEFAULT_LESSON_MINUTES } from "../../plans/planner/plan-units";
import { loadStudyWeek } from "../../progress/_utils/load-study-week";
import { readBlockPayload } from "../block-payload";
import { getDailyTimeLimitStatus } from "../get-daily-time-limit";
import { getDayMissions, hasDayMissionBonus } from "../missions/get-day-missions";
import { loadBlockSubjects } from "./block-subjects";
import { loadCatchUpView } from "./catch-up";
import { isCurrentSession } from "./current-session";
import { getGoalDayMinutes } from "./day-minutes";
import { getExamPrepAccess } from "./exam-access";
import { withExtraStudyCheck } from "./extra-blocks";
import { withLessonDisplayMinutes } from "./lesson-display-minutes";
import { isDayAwaitingOutlines } from "./outlining-stand-ins";
import { loadSessionAnswers } from "./session-answers";
import { type EmptyDay, type StudySessionView, toStudySessionView } from "./session-view";
import { type StudySessionRow } from "./study-session-access";

/**
 * Why a session with no blocks has none, when its day has study time: the plan still outlines the
 * lessons it waits for (its stand-ins, `isWritingItem`), which land in the day on their own, or it
 * has no new lesson left for the day, which no wait would change.
 */
async function loadEmptyDay({
  dayMinutes,
  session,
}: {
  dayMinutes: number;
  session: StudySessionRow;
}): Promise<EmptyDay | null> {
  if (session.blocks.length > 0 || dayMinutes === 0 || !session.goalId) {
    return null;
  }

  const coming = await prisma.planItem.count({
    where: {
      chapterId: null,
      kind: "lesson",
      lessonId: null,
      plan: { goalId: session.goalId },
      status: "todo",
    },
  });

  return coming > 0 ? "lessonsComing" : "nothingNew";
}

/**
 * Whether the day holds time for lessons still being outlined: it's the learner's day, not done,
 * with time left for a lesson, and its outlines are being written (`isDayAwaitingOutlines`); they
 * join its end once they land (`refreshDayFromPlan`).
 */
async function loadLessonsComing({
  current,
  dayMinutes,
  session,
}: {
  current: boolean;
  dayMinutes: number;
  session: StudySessionRow;
}): Promise<boolean> {
  const hasTime = dayMinutes - session.plannedMinutes >= DEFAULT_LESSON_MINUTES;

  if (!current || !hasTime || session.status === "completed" || !session.goal) {
    return false;
  }

  return isDayAwaitingOutlines({ goal: session.goal, localDate: session.localDate });
}

/** Loads what the session view model reads: answers, missions, the week, limits and access. */
export async function loadStudySessionView({
  session: storedSession,
  timeZone,
  userId,
  weekDate = storedSession.localDate,
}: {
  session: StudySessionRow;
  timeZone: string;
  userId: string;
  /** Today shows the request's week while a session carried across midnight keeps its own day. */
  weekDate?: Date;
}): Promise<StudySessionView> {
  const [
    answers,
    week,
    dailyLimit,
    allowance,
    plan,
    oftenTestedSkillIds,
    blockSubjects,
    blockedTestOutChapters,
    blocksWithLessonMinutes,
  ] = await Promise.all([
    loadSessionAnswers({ blocks: storedSession.blocks, sessionId: storedSession.id, userId }),
    loadStudyWeek({ localDate: weekDate, userId }),
    getDailyTimeLimitStatus(),
    getAllowance(),
    storedSession.goalId
      ? prisma.plan.findUnique({
          select: { settings: true },
          where: { goalId: storedSession.goalId },
        })
      : null,
    loadOftenTestedSkillIds(storedSession.goal),
    loadBlockSubjects({ blocks: storedSession.blocks, goal: storedSession.goal }),
    storedSession.goalId
      ? loadBlockedTestOutChapters({
          chapterIds: [
            ...new Set(
              storedSession.blocks.flatMap((block) => readBlockPayload(block).chapterId ?? []),
            ),
          ],
          goalId: storedSession.goalId,
          now: new Date(),
          timeZone,
          userId,
        })
      : new Set<string>(),
    withLessonDisplayMinutes({ blocks: storedSession.blocks }),
  ]);

  const session = {
    ...storedSession,
    blocks: withoutLockedPhaseChallenges({
      blocks: storedSession.blocks,
      phaseChallengesRequired:
        storedSession.goal?.kind !== "language" || allowance?.tier === "plus",
    }),
  };

  const dayMinutes = session.goal
    ? getGoalDayMinutes({
        date: session.localDate,
        goal: session.goal,
        planSettings: plan?.settings,
      })
    : 0;

  const visibleBlockIds = new Set(session.blocks.map((block) => block.id));
  const displayBlocks = blocksWithLessonMinutes.filter((block) => visibleBlockIds.has(block.id));

  const current = isCurrentSession({ now: new Date(), session, timeZone });

  const [emptyDay, lessonsComing, missions, fullMealEarned] = await Promise.all([
    loadEmptyDay({ dayMinutes, session }),
    loadLessonsComing({ current, dayMinutes, session }),
    getDayMissions({ displayBlocks, session, timeZone, ...(current && { through: new Date() }) }),
    hasDayMissionBonus({ session, timeZone, ...(current && { now: new Date() }) }),
  ]);

  const examAccess = session.goal
    ? getExamPrepAccess({
        examPrep: allowance?.examPrep ?? null,
        goal: session.goal,
        timeZone,
        today: session.localDate,
      })
    : { includesMockExams: true, trialEnded: false };

  const view = toStudySessionView({
    answers,
    blockSubjects,
    blockedTestOutChapters,
    current,
    dailyLimit,
    dayMinutes,
    emptyDay,
    examAccess,
    fullMealEarned,
    lessonsComing,
    missions,
    oftenTestedSkillIds,
    session,
    week,
  });

  const [extraTime, catchUp] = await Promise.all([
    withExtraStudyCheck({ extraTime: view.extraTime, session, userId }),
    loadCatchUpView({
      blocks: session.blocks,
      dailyMinutes: session.goal?.dailyMinutes ?? 0,
      examTomorrow: view.examTomorrow,
      freshStart: session.freshStart,
      goalId: session.goalId,
      trialEnded: examAccess.trialEnded,
      userId,
    }),
  ]);

  const displayMinutes = new Map(displayBlocks.map((block) => [block.id, block.estimatedMinutes]));

  return {
    ...view,
    blocks: view.blocks.map((block) => ({
      ...block,
      estimatedMinutes: displayMinutes.get(block.id) ?? block.estimatedMinutes,
    })),
    catchUp,
    extraTime,
  };
}
