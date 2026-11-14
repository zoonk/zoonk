import "server-only";
import { prisma } from "@zoonk/db";
import {
  arePhaseChallengesRequired,
  shouldRefillAfterEntitlementLapse,
  withoutLockedPhaseChallenges,
} from "../../checkpoints/_utils/phase-challenge-access";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { loadSkillPrerequisites } from "../../library/skills/skill-prerequisites";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { readBlockPayload } from "../block-payload";
import { getSessionMinutes, getVisibleSessionTotal } from "../session-minutes";
import { loadCarriedItemIds } from "./catch-up";
import { getGoalDayMinutes } from "./day-minutes";
import { getDayCatchUp, getDayProgress } from "./day-progress";
import { loadExamPrepAccess } from "./load-exam-access";
import { loadSessionBlockViews } from "./load-session-block-views";
import { getDayOutlines } from "./outlining-stand-ins";
import { hasSessionLessonReservation } from "./session-lesson-reservation";
import { getNextBlockId, getSessionBar } from "./session-view";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

/**
 * The day's time as Today counts it: locked phase challenges hidden, and time held for lessons
 * not written yet still counts as left.
 */
export async function loadSessionTime({
  stored,
  userId,
}: {
  stored: StudySessionRow;
  userId: string;
}) {
  const required =
    !stored.goal ||
    !shouldRefillAfterEntitlementLapse({ blocks: stored.blocks, phaseChallengesRequired: false }) ||
    (await arePhaseChallengesRequired({ goalKind: stored.goal.kind, userId }));

  const session = {
    ...stored,
    blocks: withoutLockedPhaseChallenges({
      blocks: stored.blocks,
      phaseChallengesRequired: required,
    }),
  };

  const [plan, access] = await Promise.all([
    session.goalId
      ? prisma.plan.findUnique({
          include: { items: { orderBy: { position: "asc" } } },
          where: { goalId: session.goalId },
        })
      : null,
    session.goal ? loadExamPrepAccess({ goal: session.goal }) : null,
  ]);

  const prerequisites = plan
    ? await loadSkillPrerequisites(parsePlanGraph(plan.graph).skills.map((skill) => skill.skillId))
    : new Map();

  const reserved = hasSessionLessonReservation({
    access: access ?? { includesMockExams: true, trialEnded: false },
    plan,
    prerequisites,
    session,
  });

  const minutes = getSessionMinutes({
    blocks: session.blocks,
    dailyGoal: session.goal
      ? getGoalDayMinutes({
          date: session.localDate,
          goal: session.goal,
          planSettings: plan?.settings,
        })
      : 0,
    planned: getVisibleSessionTotal({
      blocks: stored.blocks,
      planned: stored.plannedMinutes,
      visibleIds: new Set(session.blocks.map((block) => block.id)),
    }),
    reserved,
  });

  return { minutes, plan, reserved, session };
}

/** Whether the lessons the day holds time for are being written now, as Today says it. */
async function areLessonsComing({
  plan,
  reserved,
  session,
}: {
  plan: { graph: unknown } | null;
  reserved: boolean;
  session: StudySessionRow;
}): Promise<boolean> {
  if (!reserved || !session.goal) {
    return false;
  }

  const outlines = await getDayOutlines({
    goal: session.goal,
    graph: plan?.graph,
    localDate: session.localDate,
  });

  return outlines === "awaiting";
}

/** Read after settlement: a concurrent append must appear in both the queue and its next step. */
export async function loadCompletionQueue({
  blockId,
  sessionId,
  timeZone,
  userId,
}: {
  blockId: string;
  sessionId: string;
  timeZone: string;
  userId: string;
}) {
  const stored = await prisma.studySession.findFirstOrThrow({
    include: STUDY_SESSION_INCLUDE,
    where: { id: sessionId, userId },
  });

  const [{ minutes, plan, reserved, session }, carriedItemIds] = await Promise.all([
    loadSessionTime({ stored, userId }),
    loadCarriedItemIds(stored.goalId),
  ]);

  const [projection, lessonsComing] = await Promise.all([
    loadSessionBlockViews({ plan, session, timeZone, userId }),
    areLessonsComing({ plan, reserved, session }),
  ]);

  const nextBlockId = getNextBlockId(session.blocks);
  const nextBlock = projection.blocks.find((block) => block.id === nextBlockId) ?? null;
  const sessionBar = getSessionBar(session.blocks);
  const sessionCompleted = session.status === "completed" && nextBlockId === null;

  return {
    blocks: projection.blocks,
    dayProgress: getDayProgress({
      catchUp: getDayCatchUp({
        carriedItemIds,
        dayStart: getStartOfLocalDay({
          localDate: session.localDate,
          timeZone: getAnswerTimeZone({ goal: session.goal, timeZone }),
        }),
        freshStart: session.freshStart,
        items: plan?.items ?? [],
      }),
      complete: sessionCompleted,
      lessonsComing,
      reserved,
      sessionBar,
    }),
    deferredLessonsCount: readBlockPayload(
      session.blocks.find((block) => block.id === blockId) ?? { payload: {} },
    ).deferredLessonsCount,
    finishedChapterId: projection.blocks.find((block) => block.id === blockId)?.chapterId ?? null,
    goalId: session.goalId,
    minutes,
    next: nextBlock
      ? {
          block: nextBlock,
          opensInPlayer: nextBlock.opensInPlayer,
          target: { blockId: nextBlock.id, kind: "block" as const },
        }
      : null,
    nextBlockId,
    sessionBar,
    sessionCompleted,
    sessionId,
  };
}
