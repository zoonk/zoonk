import "server-only";
import {
  type Plan,
  type PlanItem,
  type StudySessionBlock,
  type TransactionClient,
} from "@zoonk/db";
import { findActiveSubscriptionForUser } from "../../auth/subscription";
import { arePhaseChallengesRequired } from "../../checkpoints/_utils/phase-challenge-access";
import { getExamPrepAccess as getTierExamPrep } from "../../entitlements/limits";
import { loadSkillPrerequisites } from "../../library/skills/skill-prerequisites";
import { parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";
import { readBlockPayload } from "../block-payload";
import { getSessionUsedMinutes } from "../session-minutes";
import { getLessonLookahead, getUnwrittenMinutesOn } from "./day-lessons";
import { getExamPrepAccess } from "./exam-access";
import { markLessonsAroundChallenges } from "./lessons-before-challenges";
import { loadPlanLessons } from "./load-plan-lessons";
import {
  getSessionLessonCandidates,
  hasSessionLessonReservation,
} from "./session-lesson-reservation";
import { takeLessons, toLessonBlock } from "./session-lessons";
import { lockSessionQueue } from "./session-queue-lock";
import { type StudySessionRow } from "./study-session-access";

type RefitPlan = Plan & { items: PlanItem[] };

function shouldDeferCheckpoint({
  block,
  items,
  lessons,
  today,
}: {
  block: StudySessionBlock;
  items: readonly PlanItem[];
  lessons: readonly StudySessionBlock[];
  today: Date;
}): boolean {
  const { checkpoint, extra, planItemId, planItemKey, reinforcement } = readBlockPayload(block);

  if (
    block.status !== "pending" ||
    block.startedAt !== null ||
    !checkpoint ||
    checkpoint.kind === "finalBoss" ||
    checkpoint.mock ||
    extra ||
    reinforcement
  ) {
    return false;
  }

  return markLessonsAroundChallenges({
    checkpoints: [{ ...checkpoint, planItemId, planItemKey }],
    items,
    lessons: lessons.map((lesson) => readBlockPayload(lesson)),
    today,
  }).some((lesson) => lesson.beforeChallenge);
}

async function trimSessionLessons({
  completedBlockId,
  plan,
  session,
  tx,
}: {
  completedBlockId?: string;
  plan: RefitPlan | null;
  session: StudySessionRow;
  tx: TransactionClient;
}) {
  if (!completedBlockId) {
    return session.blocks;
  }

  const finalBosses = session.blocks.flatMap((block) => {
    const { checkpoint, planItemId, planItemKey } = readBlockPayload(block);

    return checkpoint?.kind === "finalBoss" &&
      !checkpoint.mock &&
      (block.status === "pending" || block.status === "active")
      ? [{ ...checkpoint, planItemId, planItemKey, rematch: false }]
      : [];
  });

  const tail = markLessonsAroundChallenges({
    checkpoints: finalBosses,
    items: plan?.items ?? [],
    lessons: session.blocks.map((block) => ({ ...readBlockPayload(block), block })),
    today: session.localDate,
  })
    .filter(
      ({ beforeChallenge, block, extra, reinforcement }) =>
        !beforeChallenge &&
        block.kind === "learn" &&
        block.status === "pending" &&
        block.startedAt === null &&
        !extra &&
        !reinforcement,
    )
    .map(({ block }) => block)
    .toReversed();

  const usedMinutes = getSessionUsedMinutes(session.blocks);

  const lessons = tail.filter(
    (_, index) =>
      usedMinutes -
        tail.slice(0, index).reduce((sum, block) => sum + (block.estimatedMinutes ?? 0), 0) >
      session.plannedMinutes,
  );

  const checkpoints = session.blocks.filter((block) =>
    shouldDeferCheckpoint({ block, items: plan?.items ?? [], lessons, today: session.localDate }),
  );

  const leaving = [...lessons, ...checkpoints];

  if (leaving.length > 0) {
    await tx.studySessionBlock.deleteMany({
      where: { id: { in: leaving.map((block) => block.id) }, startedAt: null, status: "pending" },
    });
  }

  const leavingIds = new Set(leaving.map((block) => block.id));
  return session.blocks.filter((block) => !leavingIds.has(block.id));
}

async function refillSessionLessons(
  tx: TransactionClient,
  {
    plan,
    session,
    subscription,
    timeZone,
  }: {
    plan: RefitPlan | null;
    session: StudySessionRow & { goal: NonNullable<StudySessionRow["goal"]> };
    subscription: Awaited<ReturnType<typeof findActiveSubscriptionForUser>>;
    timeZone: string;
  },
) {
  const { blocks, id: sessionId } = session;

  const room = session.plannedMinutes - getSessionUsedMinutes(blocks);

  if (room < 1) {
    return { blocks, reserved: false };
  }

  if (!plan) {
    return { blocks, reserved: false };
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

  const phaseChallengesRequired = await arePhaseChallengesRequired({
    goalKind: session.goal.kind,
    readSubscription: async () => subscription,
    userId: session.userId,
  });

  const candidates = getSessionLessonCandidates({
    blocks,
    goal: session.goal,
    localDate: session.localDate,
    phaseChallengesRequired,
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
    phaseChallengesRequired,
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

  return { blocks: current.blocks, reserved };
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

  const usedMinutes = getSessionUsedMinutes(session.blocks);
  const needsTrim = Boolean(completedBlockId) && usedMinutes > session.plannedMinutes;

  if (!needsTrim && session.plannedMinutes - usedMinutes < 1) {
    return false;
  }

  const [plan, subscription] = await Promise.all([
    tx.plan.findUnique({
      include: { items: { orderBy: { position: "asc" } } },
      where: { goalId: session.goal.id },
    }),
    session.goal.kind === "exam" || session.goal.kind === "language"
      ? findActiveSubscriptionForUser({ client: tx, now: new Date(), userId: session.userId })
      : null,
  ]);

  const trimmed = await trimSessionLessons({ completedBlockId, plan, session, tx });

  const { blocks, reserved } = await refillSessionLessons(tx, {
    plan,
    session: { ...session, blocks: trimmed, goal: session.goal },
    subscription,
    timeZone,
  });

  if (completedBlockId && trimmed.length < session.blocks.length) {
    const completed = blocks.find((block) => block.id === completedBlockId);

    if (!completed) {
      throw new Error("The completed lesson is missing from its locked day.");
    }

    const deferredLessonsCount = session.blocks.filter(
      (block) =>
        block.kind === "learn" &&
        !blocks.some(
          (current) =>
            current.id === block.id || (block.lessonId && current.lessonId === block.lessonId),
        ),
    ).length;

    await tx.studySessionBlock.update({
      data: { payload: { ...readBlockPayload(completed), deferredLessonsCount } },
      where: { id: completedBlockId },
    });
  }

  return reserved;
}
