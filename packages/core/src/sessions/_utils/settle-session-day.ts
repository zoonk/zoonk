import "server-only";
import { prisma } from "@zoonk/db";
import { scheduleMemoryAfterSession } from "../../memory/after-session";
import { rebalancePlanAfterSession } from "../../preparation/rebalance-plan";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { BRAIN_POWER_BONUS } from "../brain-power";
import { getSessionBlockMinutes } from "../daily-goal";
import { type Mission, isFullMeal } from "../missions";
import { refreshPlanAroundSession } from "./refresh-plan";
import { type SessionAnswer, loadSessionAnswers } from "./session-answers";
import { trackSessionCompleted } from "./session-events";
import { addSessionBrainPower, recordSessionEnd } from "./session-ledger";
import { countMistakesFixedToday, getSessionMissions } from "./session-missions";
import { applySessionProgress } from "./session-progress";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

const SECONDS_PER_MINUTE = 60;

type SessionDay = { session: StudySessionRow; timeZone: string; userId: string };

/**
 * Pays the full meal once per learner-local day, whichever goal's session completes the missions.
 * The check runs under the progress lock, so two sessions finishing at once can't both pay it.
 */
async function payFullMeal({ session, timeZone, userId }: SessionDay): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });

    const paidToday = await tx.studySession.count({
      where: { fullMealAt: { not: null }, localDate: session.localDate, userId },
    });

    if (paidToday > 0) {
      return false;
    }

    await tx.studySession.update({
      data: { fullMealAt: lock.completedAt },
      where: { id: session.id },
    });

    await applySessionProgress(tx, {
      completion: false,
      delta: {
        brainPower: BRAIN_POWER_BONUS.fullMeal,
        correctAnswers: 0,
        energyDelta: 0,
        incorrectAnswers: 0,
        seconds: 0,
      },
      lock,
      userId,
    });

    await addSessionBrainPower(tx, {
      brainPower: BRAIN_POWER_BONUS.fullMeal,
      sessionId: session.id,
      userId,
    });

    return true;
  });
}

/**
 * A session whose blocks are all done or skipped is complete: its ledger row closes, the plan
 * re-flows what the day left undone, "Session Completed" goes out the first time and memory reads
 * the session after the response. When two blocks finish at once, only the request that completed
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

  if (!finished || session.status === "completed") {
    return session.status === "completed";
  }

  const endedAt = new Date();

  const completed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.studySession.updateMany({
      data: { endedAt, status: "completed" },
      where: { id: session.id, status: { not: "completed" } },
    });

    if (count === 0) {
      return false;
    }

    await recordSessionEnd(tx, {
      endedAt,
      sessionId: session.id,
      timeZone,
      totals: {
        correctAnswers: answers.filter((answer) => answer.isCorrect).length,
        incorrectAnswers: answers.filter((answer) => !answer.isCorrect).length,
        seconds: Math.round(getSessionBlockMinutes(session.blocks) * SECONDS_PER_MINUTE),
      },
      userId,
    });

    return true;
  });

  if (!completed) {
    return true;
  }

  // "10 more minutes" reopens a finished session; finishing it again isn't a new session.
  if (!session.endedAt) {
    trackSessionCompleted(session);
  }

  scheduleMemoryAfterSession({ goalId: session.goalId, sessionId: session.id, timeZone, userId });

  await refreshPlanAroundSession({ goalId: session.goalId });
  await rebalancePlanAfterSession({ goalId: session.goalId, userId });

  return true;
}

type SettledSessionDay = {
  fullMealPaid: boolean;
  missions: Mission[];
  session: StudySessionRow;
  sessionCompleted: boolean;
};

/**
 * What happens after any block of the session finishes: the missions are checked (a full meal pays
 * +50 once a day) and the session completes when nothing is left.
 */
export async function settleSessionDay({
  sessionId,
  timeZone,
  userId,
}: {
  sessionId: string;
  timeZone: string;
  userId: string;
}): Promise<SettledSessionDay> {
  const session = await prisma.studySession.findUniqueOrThrow({
    include: STUDY_SESSION_INCLUDE,
    where: { id: sessionId },
  });

  const [answers, fixedToday] = await Promise.all([
    loadSessionAnswers({ blocks: session.blocks, sessionId, userId }),
    countMistakesFixedToday({ localDate: session.localDate, timeZone, userId }),
  ]);

  const answeredItemIds = new Set(
    answers.flatMap((answer) => (answer.itemId ? [answer.itemId] : [])),
  );

  const missions = getSessionMissions({ answeredItemIds, blocks: session.blocks, fixedToday });
  const day = { session, timeZone, userId };
  const fullMealPaid = isFullMeal(missions) && !session.fullMealAt && (await payFullMeal(day));
  const sessionCompleted = await completeIfFinished({ ...day, answers });

  return { fullMealPaid, missions, session, sessionCompleted };
}
