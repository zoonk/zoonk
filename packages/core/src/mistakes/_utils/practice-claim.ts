import "server-only";
import { type Attempt, type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findSavedAttempt } from "../../learner/_utils/answer-once";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { getPracticeTimeZone, readyMistakeWhere } from "../mistake-availability";

type PracticeClaim = { mistakeId: string; timeZone: string; userId: string };

function today(timeZone: string) {
  return { localDate: getDateInTimeZone({ date: new Date(), timeZone }), timeZone };
}

/** A ready mistake takes one practice answer: it leaves fixed, or waits for the next day. Under the learner lock, this is that answer's claim. */
async function isMistakeReady(
  { mistakeId, timeZone, userId }: PracticeClaim,
  db: TransactionClient = prisma,
): Promise<boolean> {
  const ready = await db.mistake.count({
    where: { ...readyMistakeWhere(today(timeZone)), id: mistakeId, userId },
  });

  return ready > 0;
}

/** For `recordAnswerOnce`: refuses a second answer that got past the first check at the same time. */
export function refuseAnsweredMistake(claim: PracticeClaim) {
  return async function refuse(transaction: TransactionClient): Promise<"answered" | null> {
    return (await isMistakeReady(claim, transaction)) ? null : "answered";
  };
}

/** The answer that counted for this mistake today, so a stale screen or a lost reply gets it back instead of a second reward. */
function findCountedPracticeAnswer({
  mistakeId,
  timeZone,
  userId,
}: PracticeClaim): Promise<Attempt | null> {
  return prisma.attempt.findFirst({
    orderBy: [{ answeredAt: "desc" }, { id: "desc" }],
    where: {
      answer: { equals: mistakeId, path: ["practiceMistakeId"] },
      answeredAt: { gte: getStartOfLocalDay(today(timeZone)) },
      studySessionId: null,
      userId,
    },
  });
}

/** The day's zone and the answer to replay, if any; null when the mistake takes no answer today and none counted. */
export async function readPracticeClaim({
  attemptId,
  goalId,
  mistakeId,
  timeZone,
  userId,
}: {
  attemptId: string;
  goalId?: string;
  mistakeId: string;
  timeZone?: string;
  userId: string;
}): Promise<{ saved: Attempt | null; timeZone: string } | null> {
  const owned = goalId ? await findOwnedGoal(goalId) : null;
  const goal = owned?.status === "ready" ? owned.goal : null;
  const zone = await getPracticeTimeZone({ goal, timeZone, userId });
  const claim = { mistakeId, timeZone: zone, userId };
  const ready = await isMistakeReady(claim);

  const saved =
    (await findSavedAttempt({ attemptId, userId })) ??
    (ready ? null : await findCountedPracticeAnswer(claim));

  return ready || saved ? { saved, timeZone: zone } : null;
}
