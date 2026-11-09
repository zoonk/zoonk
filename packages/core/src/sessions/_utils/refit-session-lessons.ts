import { type StudySessionBlock, type TransactionClient } from "@zoonk/db";
import "server-only";
import { findActiveSubscriptionForUser } from "../../auth/subscription";
import {
  type ChallengeReachItem,
  isPhaseChallenge,
} from "../../checkpoints/_utils/challenge-reach";
import { getExamPrepAccess as getTierExamPrep } from "../../entitlements/limits";
import { loadSkillPrerequisites } from "../../library/skills/skill-prerequisites";
import { parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";
import { readBlockPayload } from "../block-payload";
import { getSessionUsedMinutes } from "../session-minutes";
import { getLessonLookahead, getUnwrittenMinutesOn } from "./day-lessons";
import { orderDayBlocks } from "./day-stretch";
import { getExamPrepAccess } from "./exam-access";
import { loadPlanLessons } from "./load-plan-lessons";
import { buildCheckpointBlock } from "./planned-checkpoint-block";
import { fitRefillStretch } from "./refill-challenges";
import {
  getSessionLessonCandidates,
  hasSessionLessonReservation,
} from "./session-lesson-reservation";
import { toLessonBlock } from "./session-lessons";
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
    return { blocks: session.blocks, leaving: [] };
  }

  const tail = session.blocks
    .filter((block) => {
      const payload = readBlockPayload(block);

      return (
        (block.kind === "learn" ||
          (block.kind === "checkpoint" &&
            payload.checkpoint &&
            isPhaseChallenge(payload.checkpoint))) &&
        block.status === "pending" &&
        block.startedAt === null &&
        !payload.extra &&
        !payload.reinforcement
      );
    })
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

  return { blocks, leaving };
}

async function saveDeferredCount({
  blocks,
  completedBlockId,
  leaving,
  tx,
}: {
  blocks: readonly StudySessionBlock[];
  completedBlockId?: string;
  leaving: readonly StudySessionBlock[];
  tx: TransactionClient;
}) {
  if (!completedBlockId || leaving.length === 0) {
    return;
  }

  const completed = blocks.find((block) => block.id === completedBlockId);

  if (!completed) {
    throw new Error("The completed lesson is missing from its locked day.");
  }

  const returned = new Set(blocks.flatMap((block) => block.lessonId ?? []));

  const count = leaving.filter(
    (block) => block.kind === "learn" && (!block.lessonId || !returned.has(block.lessonId)),
  ).length;

  await tx.studySessionBlock.update({
    data: { payload: { ...readBlockPayload(completed), deferredLessonsCount: count } },
    where: { id: completedBlockId },
  });
}

async function orderRefilledBlocks({
  added,
  blocks,
  items,
  tx,
}: {
  added: readonly StudySessionBlock[];
  blocks: readonly StudySessionBlock[];
  items: readonly ChallengeReachItem[];
  tx: TransactionClient;
}) {
  if (added.length > 0) {
    const pending = [...blocks, ...added].filter(
      (block) =>
        (block.status === "pending" || block.status === "active") && !readBlockPayload(block).extra,
    );

    const ordered = orderDayBlocks({ blocks: pending, items });
    const positions = pending.map((block) => block.position).toSorted((a, b) => a - b);
    const moved = ordered.filter((block, index) => block.position !== positions[index]);

    if (moved.length > 0) {
      await tx.studySessionBlock.updateMany({
        data: { position: { increment: Math.max(...positions) + 1 } },
        where: { id: { in: moved.map((block) => block.id) } },
      });

      await Promise.all(
        moved.map((block) =>
          tx.studySessionBlock.update({
            data: { position: positions[ordered.indexOf(block)] },
            where: { id: block.id },
          }),
        ),
      );
    }
  }
}

/** The learner lock is already held; only the completion may remove unstarted tail lessons. */
export async function refitSessionLessons(
  tx: TransactionClient,
  {
    sessionId,
    completedBlockId,
    timeZone,
  }: { sessionId: string; completedBlockId?: string; timeZone: string },
): Promise<{ reserved: boolean }> {
  const session = await lockSessionQueue({ sessionId, tx });

  if (!session?.goal || session.status === "completed") {
    return { reserved: false };
  }

  const { blocks, leaving } = await trimSessionLessons({ completedBlockId, session, tx });
  const room = session.plannedMinutes - getSessionUsedMinutes(blocks);

  if (room < 1) {
    await saveDeferredCount({ blocks, completedBlockId, leaving, tx });
    return { reserved: false };
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
    return { reserved: false };
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
    access,
    blocks,
    goal: session.goal,
    localDate: session.localDate,
    plan,
    prerequisites,
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

  const { checkpoints, stretch } = await fitRefillStretch({
    access,
    blocks,
    budget: room - writingMinutes,
    leaving,
    lessons,
    plan,
    session: { ...session, goal: session.goal },
    tx,
  });

  const fitting = stretch.map((entry) =>
    entry.kind === "lesson"
      ? toLessonBlock(entry.lesson, false)
      : buildCheckpointBlock(entry.checkpoint),
  );

  const position = Math.max(-1, ...session.blocks.map((block) => block.position)) + 1;

  const added =
    fitting.length > 0
      ? await tx.studySessionBlock.createManyAndReturn({
          data: fitting.map((block, index) => ({
            ...block,
            position: position + index,
            sessionId,
          })),
        })
      : [];

  await orderRefilledBlocks({ added, blocks, items: plan.items, tx });

  await saveDeferredCount({ blocks: [...blocks, ...added], completedBlockId, leaving, tx });

  const current = { ...session, blocks: [...blocks, ...added] };

  const reserved = hasSessionLessonReservation({ access, plan, prerequisites, session: current });

  if (
    !reserved &&
    fitting.length === 0 &&
    room > 0 &&
    ((candidates.length === 0 && checkpoints.length === 0) ||
      !blocks.some((block) => block.status === "active" || block.status === "pending"))
  ) {
    await tx.studySession.update({
      data: { plannedMinutes: Math.ceil(getSessionUsedMinutes(blocks)) },
      where: { id: sessionId },
    });
  }

  return { reserved };
}
