import { prisma } from "@zoonk/db";
import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { withoutLockedPhaseChallenges } from "../../checkpoints/_utils/phase-challenge-access";
import { getEntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { getExamPrepAccess as getTierExamPrep } from "../../entitlements/limits";
import { loadOftenTestedSkillIds } from "../../exams/map/load-often-tested";
import { loadBlockedTestOutChapters } from "../../learner/test-out/_utils/offer-eligibility";
import { DEFAULT_LESSON_MINUTES } from "../../plans/planner/plan-units";
import { loadStudyWeek } from "../../progress/_utils/load-study-week";
import { readBlockPayload } from "../block-payload";
import { getDailyTimeLimitStatus } from "../get-daily-time-limit";
import { getDayMissions, hasDayMissionBonus } from "../missions/get-day-missions";
import { loadBlockSubjects } from "./block-subjects";
import { loadCatchUpView } from "./catch-up";
import { getCarryOverEnd, isCurrentSession } from "./current-session";
import { getGoalDayMinutes } from "./day-minutes";
import { getExamPrepAccess } from "./exam-access";
import { withExtraStudyCheck } from "./extra-blocks";
import { withLessonDisplayMinutes } from "./lesson-display-minutes";
import { isDayAwaitingOutlines } from "./outlining-stand-ins";
import { type PlannedStudyDay } from "./plan-study-day";
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

function loadViewPlan({ fresh, session }: { fresh?: PlannedStudyDay; session: StudySessionRow }) {
  if (fresh) {
    return { settings: fresh.plan.settings };
  }

  return session.goalId
    ? prisma.plan.findUnique({ select: { settings: true }, where: { goalId: session.goalId } })
    : null;
}

async function loadSessionBasics({
  initialDay,
  session,
  userId,
}: {
  initialDay?: PlannedStudyDay;
  session: StudySessionRow;
  userId: string;
}) {
  const fresh =
    session.startedAt === null && session.blocks.every((block) => block.status === "pending")
      ? initialDay
      : undefined;

  const [answers, dailyLimit, viewer, plan] = await Promise.all([
    fresh ? [] : loadSessionAnswers({ blocks: session.blocks, sessionId: session.id, userId }),
    getDailyTimeLimitStatus(),
    fresh ? { tier: fresh.plan.tier } : getEntitlementViewer(),
    loadViewPlan({ fresh, session }),
  ]);

  return { answers, dailyLimit, plan, viewer };
}

/** Loads what the session view model reads: answers, missions, the week, limits and access. */
export async function loadStudySessionView({
  initialDay,
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
  initialDay?: PlannedStudyDay;
}): Promise<StudySessionView> {
  const [
    basics,
    week,
    oftenTestedSkillIds,
    blockSubjects,
    blockedTestOutChapters,
    blocksWithLessonMinutes,
  ] = await Promise.all([
    loadSessionBasics({ initialDay, session: storedSession, userId }),
    loadStudyWeek({ localDate: weekDate, userId }),
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

  const { answers, dailyLimit, plan, viewer } = basics;

  const visibleBlocks = withoutLockedPhaseChallenges({
    blocks: storedSession.blocks,
    phaseChallengesRequired: storedSession.goal?.kind !== "language" || viewer?.tier === "plus",
  });

  const session = {
    ...storedSession,
    blocks: visibleBlocks,
    plannedMinutes:
      visibleBlocks.length === storedSession.blocks.length
        ? storedSession.plannedMinutes
        : visibleBlocks.reduce((sum, block) => sum + (block.estimatedMinutes ?? 0), 0),
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

  const now = new Date();
  const current = isCurrentSession({ now, session, timeZone });
  const today = getDateInTimeZone({ date: now, timeZone });

  const dayEndsAt =
    current && session.localDate < today ? getCarryOverEnd(session).getTime() : undefined;

  const [emptyDay, lessonsComing, missions, fullMealEarned] = await Promise.all([
    loadEmptyDay({ dayMinutes, session }),
    loadLessonsComing({ current, dayMinutes, session }),
    getDayMissions({ displayBlocks, session, timeZone, ...(current && { through: new Date() }) }),
    hasDayMissionBonus({ session, timeZone, ...(current && { now: new Date() }) }),
  ]);

  const examAccess = session.goal
    ? getExamPrepAccess({
        examPrep: viewer ? getTierExamPrep(viewer.tier) : null,
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
    dayEndsAt,
    dayMinutes,
    emptyDay,
    examAccess,
    fullMealEarned,
    lessonsComing,
    missions,
    oftenTestedSkillIds,
    session,
    timeZone,
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
