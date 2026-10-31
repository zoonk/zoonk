import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

/** Crossing midnight must not interrupt an active study day; the new day waits until the learner has been away. */
const CARRY_OVER_MS = 60 * 60 * 1000;

type SessionTimes = Pick<StudySessionRow, "endedAt" | "localDate" | "startedAt" | "status"> & {
  blocks: readonly Pick<StudySessionRow["blocks"][number], "completedAt" | "startedAt">[];
};

function getLastActivity(session: SessionTimes): number {
  return Math.max(
    session.startedAt?.getTime() ?? 0,
    session.endedAt?.getTime() ?? 0,
    ...session.blocks.flatMap((block) => [
      block.startedAt?.getTime() ?? 0,
      block.completedAt?.getTime() ?? 0,
    ]),
  );
}

export function getCarryOverEnd(session: SessionTimes): Date {
  return new Date(getLastActivity(session) + CARRY_OVER_MS);
}

/** Completed days carry only if finished after midnight, so yesterday's earlier finish cannot block a new day. */
function isCarriedOver({
  now,
  session,
  timeZone,
}: {
  now: Date;
  session: SessionTimes;
  timeZone: string;
}): boolean {
  if (!session.startedAt || now.getTime() >= getCarryOverEnd(session).getTime()) {
    return false;
  }

  if (session.status !== "completed") {
    return true;
  }

  const nextDay = new Date(session.localDate.getTime() + MS_PER_DAY);
  const midnight = getStartOfLocalDay({ localDate: nextDay, timeZone });

  return (session.endedAt?.getTime() ?? 0) >= midnight.getTime();
}

/** Includes yesterday's still-active session, never older sessions. */
export function isCurrentSession({
  now,
  session,
  timeZone,
}: {
  now: Date;
  session: SessionTimes;
  timeZone: string;
}): boolean {
  const today = getDateInTimeZone({ date: now, timeZone });
  const yesterday = new Date(today.getTime() - MS_PER_DAY);

  if (session.localDate.getTime() === today.getTime()) {
    return true;
  }

  return (
    session.localDate.getTime() === yesterday.getTime() && isCarriedOver({ now, session, timeZone })
  );
}

/** Today's started session takes precedence; otherwise a still-active yesterday may remain current. */
export function pickCurrentDay<Session extends SessionTimes>({
  now,
  previous,
  timeZone,
  today,
}: {
  now: Date;
  previous: Session | null;
  timeZone: string;
  today: Session | null;
}): Session | null {
  const carried = previous && isCarriedOver({ now, session: previous, timeZone }) ? previous : null;
  return carried && !today?.startedAt ? carried : today;
}

export async function findCarriedOverSession({
  goalId,
  now,
  timeZone,
  userId,
}: {
  goalId: string;
  now: Date;
  timeZone: string;
  userId: string;
}): Promise<StudySessionRow | null> {
  const today = getDateInTimeZone({ date: now, timeZone });

  const previous = await prisma.studySession.findUnique({
    include: STUDY_SESSION_INCLUDE,
    where: { userGoalDate: { goalId, localDate: new Date(today.getTime() - MS_PER_DAY), userId } },
  });

  return previous && isCarriedOver({ now, session: previous, timeZone }) ? previous : null;
}

export async function hasStartedDay({
  goalId,
  localDate,
  userId,
}: {
  goalId: string | null;
  localDate: Date;
  userId: string;
}) {
  const started = await prisma.studySession.findFirst({
    select: { id: true },
    where: { goalId, localDate, startedAt: { not: null }, userId },
  });

  return started !== null;
}
