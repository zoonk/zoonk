import { type ExamBlueprint } from "@zoonk/db";
import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { withoutLockedPhaseChallenges } from "../../checkpoints/_utils/phase-challenge-access";
import { readEntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { getExamPrepAccess as getTierExamPrep } from "../../entitlements/limits";
import { loadOftenTestedSkillIds } from "../../exams/map/load-often-tested";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { loadBlockedTestOutChapters } from "../../learner/test-out/_utils/offer-eligibility";
import { DEFAULT_LESSON_MINUTES } from "../../plans/planner/plan-units";
import { loadStudyWeek } from "../../progress/_utils/load-study-week";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { readBlockPayload } from "../block-payload";
import { getDayMissions, hasDayMissionBonus } from "../missions/get-day-missions";
import { loadBlockSubjects } from "./block-subjects";
import { loadCatchUpView } from "./catch-up";
import { getCarryOverEnd, isCurrentSession } from "./current-session";
import { readDailyTimeLimitStatus } from "./daily-time-limit";
import { getGoalDayMinutes } from "./day-minutes";
import { getExamPrepAccess } from "./exam-access";
import { withExtraStudyCheck } from "./extra-blocks";
import { withLessonDisplayMinutes } from "./lesson-display-minutes";
import { type DayOutlines, getDayOutlines } from "./outlining-stand-ins";
import { type PlannedStudyDay } from "./plan-study-day";
import { loadDayPlusLessons } from "./plus-only-lessons";
import { loadSessionAnswers } from "./session-answers";
import { type StudySessionView, toStudySessionView } from "./session-view";
import { type StudySessionRow } from "./study-session-access";

async function loadDayOutlines({
  dayMinutes,
  session,
}: {
  dayMinutes: number;
  session: StudySessionRow;
}): Promise<DayOutlines> {
  if (dayMinutes === 0 || session.status === "completed" || !session.goal) {
    return null;
  }

  return getDayOutlines({ goal: session.goal, localDate: session.localDate });
}

function hasLessonRoom({ dayMinutes, session }: { dayMinutes: number; session: StudySessionRow }) {
  return dayMinutes - session.plannedMinutes >= DEFAULT_LESSON_MINUTES;
}

function loadViewPlan({ fresh, session }: { fresh?: PlannedStudyDay; session: StudySessionRow }) {
  if (fresh) {
    return { settings: fresh.plan.settings };
  }

  return session.goalId ? readSavedPlan(session.userId, session.goalId) : null;
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
    getRequestProgressDateContext().then(({ currentDate }) =>
      readDailyTimeLimitStatus({ date: currentDate, userId }),
    ),
    fresh ? { tier: fresh.plan.tier } : readEntitlementViewer(),
    loadViewPlan({ fresh, session }),
  ]);

  return { answers, dailyLimit, plan, viewer };
}

export async function loadStudySessionView({
  blueprint,
  initialDay,
  session: storedSession,
  timeZone,
  userId,
  weekDate = storedSession.localDate,
}: {
  blueprint?: ExamBlueprint | null;
  session: StudySessionRow;
  timeZone: string;
  userId: string;
  /** Today may show the request's week while the carried session retains yesterday's local day. */
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
    loadBlockSubjects({ blocks: storedSession.blocks, blueprint, goal: storedSession.goal }),
    storedSession.goalId
      ? loadBlockedTestOutChapters({
          chapterIds: [
            ...new Set(
              storedSession.blocks.flatMap((block) => readBlockPayload(block).chapterId ?? []),
            ),
          ],
          goalId: storedSession.goalId,
          known: { source: readSavedPlan(userId, storedSession.goalId) },
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

  const examAccess = session.goal
    ? getExamPrepAccess({
        examPrep: viewer ? getTierExamPrep(viewer.tier) : null,
        goal: session.goal,
        timeZone,
        today: session.localDate,
      })
    : { includesMockExams: true, trialEnded: false };

  const [outlines, missions, fullMealEarned, plusLessons] = await Promise.all([
    loadDayOutlines({ dayMinutes, session }),
    getDayMissions({ displayBlocks, session, timeZone, ...(current && { through: new Date() }) }),
    hasDayMissionBonus({ session, timeZone, ...(current && { now: new Date() }) }),
    loadDayPlusLessons({
      access: examAccess,
      goalId: session.goalId,
      localDate: session.localDate,
      userId,
    }),
  ]);

  const view = toStudySessionView({
    answers,
    blockSubjects,
    blockedTestOutChapters,
    current,
    dailyLimit,
    dayEndsAt,
    dayMinutes,
    examAccess,
    fullMealEarned,
    lessonRoom: current && hasLessonRoom({ dayMinutes, session }),
    missions,
    oftenTestedSkillIds,
    outlines,
    plusLessons,
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
