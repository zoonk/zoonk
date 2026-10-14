import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { after } from "next/server";
import { markLearnerChanged } from "../../learner/_utils/mark-learner-changed";
import { scheduleMemoryAfterSession } from "../../memory/after-session";
import { type BrainPowerReward } from "../../milestones/milestone-reward";
import { rebalancePlanAfterSession } from "../../preparation/rebalance-plan";
import { type Mission } from "../missions";
import { getDayMissions } from "../missions/get-day-missions";
import { type MissionCompletionSource, settleMissions } from "../missions/settle-missions";
import { measureSessionState } from "./capture-snapshot";
import { refreshPlanAroundSession } from "./refresh-plan";
import { type SessionAnswer, loadSessionAnswers } from "./session-answers";
import { trackSessionCompleted } from "./session-events";
import { recordSessionEnd } from "./session-ledger";
import { type SessionState, readFullMealReward } from "./session-snapshot";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

type SessionDay = { session: StudySessionRow; timeZone: string; userId: string };

/**
 * Keeps where the learner stood as the session ended, so its summary says what that session
 * changed, not what later lessons did.
 */
async function keepSessionEnd(
  tx: TransactionClient,
  { end, sessionId }: { end: SessionState; sessionId: string },
) {
  await tx.studySession.update({ data: { endSnapshot: end }, where: { id: sessionId } });
}

/**
 * A session whose blocks are all done or skipped is complete: its ledger row closes, the plan
 * re-flows what the day left undone, "Session Completed" goes out the first time and memory reads
 * the session after the response (unless an earlier stop had it read already). When two blocks finish at once, only the request that completed
 * it does this.
 */
async function completeIfFinished({
  answers,
  session,
  timeZone,
  userId,
}: SessionDay & { answers: readonly SessionAnswer[] }): Promise<boolean> {
  const finished = session.blocks.every(
    (block) => block.status === "completed" || block.status === "skipped",
  );

  if (!finished) {
    return false;
  }

  const endedAt = new Date();

  const end = await measureSessionState({ goalId: session.goalId, now: endedAt, timeZone, userId });

  const completed = await prisma.$transaction(async (tx) => {
    await markLearnerChanged(tx, { planInputs: session.goalId !== null, userId });

    await tx.$queryRaw`
      SELECT id FROM study_sessions WHERE id = ${session.id}::uuid FOR NO KEY UPDATE
    `;

    // Queue writers take this row before inserting/restoring blocks. A separate read after the
    // lock sees work committed while completion waited, unlike the session read above.
    const openBlocks = await tx.studySessionBlock.count({
      where: { sessionId: session.id, status: { in: ["active", "pending"] } },
    });

    if (openBlocks > 0) {
      return { status: "open" as const };
    }

    const current = await tx.studySession.findUniqueOrThrow({ where: { id: session.id } });

    if (current.status === "completed") {
      return { status: "alreadyCompleted" as const };
    }

    await tx.studySession.update({
      data: { endedAt, status: "completed" },
      where: { id: session.id },
    });

    await keepSessionEnd(tx, { end, sessionId: session.id });

    await recordSessionEnd(tx, {
      endedAt,
      sessionId: session.id,
      timeZone,
      totals: {
        correctAnswers: answers.filter((answer) => answer.isCorrect).length,
        incorrectAnswers: answers.filter((answer) => !answer.isCorrect).length,
      },
      userId,
    });

    return { session: current, status: "completed" as const };
  });

  if (completed.status === "open") {
    return false;
  }

  if (completed.status === "alreadyCompleted") {
    return true;
  }

  // "10 more minutes" reopens a finished session; finishing it again isn't a new session.
  if (!completed.session.endedAt) {
    trackSessionCompleted({ ...session, ...completed.session });
  }

  // Memory and the rebalance read a session once, when it first ended or was first stopped: what
  // came after is in the week the next session's read measures.
  if (!completed.session.endedAt && !completed.session.stoppedAt) {
    scheduleMemoryAfterSession({ goalId: session.goalId, sessionId: session.id, timeZone, userId });
  }

  after(async () => {
    const refreshed = await refreshPlanAroundSession({
      goalId: session.goalId,
      pace: "sampled",
      retryOnConflict: false,
      revalidation: "skip",
    });

    if (refreshed && !completed.session.endedAt && !completed.session.stoppedAt) {
      await rebalancePlanAfterSession({ goalId: session.goalId, retryOnConflict: false, userId });
    }
  });

  return true;
}

type SettledSessionDay = {
  fullMealPaid: boolean;
  fullMealReward: BrainPowerReward | null;
  missions: Mission[];
  session: StudySessionRow;
  sessionCompleted: boolean;
};

/**
 * What happens after any block of the session finishes: the missions are checked (a full meal pays
 * +50 once a day) and the session completes when nothing is left.
 */
export async function settleSessionDay({
  rewardMissions = true,
  sessionId,
  source,
  timeZone,
  userId,
}: {
  /** Ending an unasked challenge closes the session without paying a completion reward. */
  rewardMissions?: boolean;
  sessionId: string;
  /** The activity that finished the block, when its screen says what it did to the missions. */
  source?: MissionCompletionSource;
  timeZone: string;
  userId: string;
}): Promise<SettledSessionDay> {
  const session = await prisma.studySession.findUniqueOrThrow({
    include: STUDY_SESSION_INCLUDE,
    where: { id: sessionId },
  });

  const [answers, settled] = await Promise.all([
    loadSessionAnswers({ blocks: session.blocks, sessionId, userId }),
    rewardMissions
      ? settleMissions({ sessionId, source, timeZone, userId })
      : getDayMissions({ session, timeZone }).then((missions) => ({
          fullMealPaid: false,
          fullMealReward: null,
          missions,
        })),
  ]);

  const { missions, fullMealPaid } = settled;
  const paidReward = settled.fullMealPaid ? settled.fullMealReward : null;
  const day = { session, timeZone, userId };
  const sessionCompleted = await completeIfFinished({ ...day, answers });

  return {
    fullMealPaid,
    fullMealReward: paidReward ?? readFullMealReward(session.startSnapshot),
    missions,
    session,
    sessionCompleted,
  };
}
