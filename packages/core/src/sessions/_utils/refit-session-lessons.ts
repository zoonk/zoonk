import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { findActiveSubscriptionForUser } from "../../auth/subscription";
import { getExamPrepAccess as getTierExamPrep } from "../../entitlements/limits";
import { loadSkillPrerequisites } from "../../library/skills/skill-prerequisites";
import { parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";
import { readBlockPayload } from "../block-payload";
import { getSessionUsedMinutes } from "../session-minutes";
import { getLessonLookahead, getUnwrittenMinutesOn } from "./day-lessons";
import { getExamPrepAccess } from "./exam-access";
import { loadPlanLessons } from "./load-plan-lessons";
import {
  getSessionLessonCandidates,
  hasSessionLessonReservation,
} from "./session-lesson-reservation";
import { takeLessons, toLessonBlock } from "./session-lessons";
import { lockSessionQueue } from "./session-queue-lock";
import { type StudySessionRow } from "./study-session-access";

async function trimSessionLessons({
  completedBlockId,
  session,
  tx,
}: {
  completedBlockId?: string;
  session: StudySessionRow;
  tx: TransactionClient;
}) {
  if (!completedBlockId) {
    return session.blocks;
  }

  const tail = session.blocks
    .filter(
      (block) =>
        block.kind === "learn" &&
        block.status === "pending" &&
        block.startedAt === null &&
        !readBlockPayload(block).extra &&
        !readBlockPayload(block).reinforcement,
    )
    .toReversed();

  const usedMinutes = getSessionUsedMinutes(session.blocks);

  const leaving = tail.filter(
    (_, index) =>
      usedMinutes -
        tail.slice(0, index).reduce((sum, block) => sum + (block.estimatedMinutes ?? 0), 0) >
      session.plannedMinutes,
  );

  if (leaving.length > 0) {
    await tx.studySessionBlock.deleteMany({
      where: { id: { in: leaving.map((block) => block.id) }, startedAt: null, status: "pending" },
    });
  }

  const leavingIds = new Set(leaving.map((block) => block.id));
  const blocks = session.blocks.filter((block) => !leavingIds.has(block.id));

  if (leaving.length > 0) {
    const completed = blocks.find((block) => block.id === completedBlockId);

    if (!completed) {
      throw new Error("The completed lesson is missing from its locked day.");
    }

    await tx.studySessionBlock.update({
      data: { payload: { ...readBlockPayload(completed), deferredLessonsCount: leaving.length } },
      where: { id: completedBlockId },
    });
  }

  return blocks;
}

/** The learner lock is already held; only the completion may remove unstarted tail lessons. */
export async function refitSessionLessons(
  tx: TransactionClient,
  {
    sessionId,
    completedBlockId,
    timeZone,
  }: { sessionId: string; completedBlockId?: string; timeZone: string },
): Promise<boolean> {
  const session = await lockSessionQueue({ sessionId, tx });

  if (!session?.goal || session.status === "completed") {
    return false;
  }

  const blocks = await trimSessionLessons({ completedBlockId, session, tx });
  const room = session.plannedMinutes - getSessionUsedMinutes(blocks);

  if (room < 1) {
    return false;
  }

  const [plan, subscription] = await Promise.all([
    tx.plan.findUnique({
      include: { items: { orderBy: { position: "asc" } } },
      where: { goalId: session.goal.id },
    }),
    session.goal.kind === "exam"
      ? findActiveSubscriptionForUser({ client: tx, now: new Date(), userId: session.userId })
      : null,
  ]);

  if (!plan) {
    return false;
  }

  const prerequisites = await loadSkillPrerequisites(
    parsePlanGraph(plan.graph).skills.map((skill) => skill.skillId),
    tx,
  );

  const access = getExamPrepAccess({
    examPrep: getTierExamPrep(subscription ? "plus" : "free"),
    goal: session.goal,
    timeZone,
    today: session.localDate,
  });

  const candidates = getSessionLessonCandidates({
    blocks,
    goal: session.goal,
    localDate: session.localDate,
    plan,
    prerequisites,
    trialEnded: access.trialEnded,
  });

  const writingMinutes = getUnwrittenMinutesOn({ items: candidates, today: session.localDate });

  const lessons =
    room - writingMinutes >= 1
      ? await loadPlanLessons({
          client: tx,
          items: candidates.filter((item) => item.lessonId).slice(0, getLessonLookahead(room)),
          paceFactor: parsePlanSettings(plan.settings).pace?.factor,
        })
      : [];

  const fitting = takeLessons({ budget: room - writingMinutes, lessons, overflow: false });

  const position = Math.max(-1, ...session.blocks.map((block) => block.position)) + 1;

  const added =
    fitting.length > 0
      ? await tx.studySessionBlock.createManyAndReturn({
          data: fitting.map((lesson, index) => ({
            ...toLessonBlock(lesson, false),
            position: position + index,
            sessionId,
          })),
        })
      : [];

  const current = { ...session, blocks: [...blocks, ...added] };

  const reserved = hasSessionLessonReservation({
    plan,
    prerequisites,
    session: current,
    trialEnded: access.trialEnded,
  });

  if (
    !reserved &&
    fitting.length === 0 &&
    room > 0 &&
    (candidates.length === 0 ||
      !blocks.some((block) => block.status === "active" || block.status === "pending"))
  ) {
    await tx.studySession.update({
      data: { plannedMinutes: Math.ceil(getSessionUsedMinutes(blocks)) },
      where: { id: sessionId },
    });
  }

  return reserved;
}
