import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

/**
 * A study day doesn't end at midnight while the learner is in it: the day before's session stays
 * theirs until they've been away from it this long, so a session started at 23:50 finishes as one
 * session and the new day's starts after it.
 */
const CARRY_OVER_MS = 60 * 60 * 1000;

type SessionTimes = Pick<StudySessionRow, "endedAt" | "localDate" | "startedAt" | "status"> & {
  blocks: readonly Pick<StudySessionRow["blocks"][number], "completedAt" | "startedAt">[];
};

/** The last moment the learner did something in the session: started or finished a block. */
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

/** When a day the learner is still in stops being theirs: once they've been away from it this long. */
export function getCarryOverEnd(session: SessionTimes): Date {
  return new Date(getLastActivity(session) + CARRY_OVER_MS);
}

/**
 * Whether the day before's session is still the learner's day: they started it and were in it a
 * moment ago. Once finished, it stays only when it finished after midnight, so its summary is what
 * they see; a day finished before midnight never holds the new day back.
 */
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

/**
 * Whether a session is the learner's day now: today's, or the day before's they're still in.
 * An earlier day's session has nothing left to open; its next step is the new day.
 */
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

/**
 * The learner's day of a goal: today's session, unless they're still in the day before's (see
 * `isCurrentSession`) and haven't started today's yet. Null when neither is saved.
 */
export function pickCurrentDay<Session extends SessionTimes>({
  now,
  previous,
  timeZone,
  today,
}: {
  now: Date;
  /** The goal's session from the day before, when saved. */
  previous: Session | null;
  timeZone: string;
  today: Session | null;
}): Session | null {
  const carried = previous && isCarriedOver({ now, session: previous, timeZone }) ? previous : null;
  return carried && !today?.startedAt ? carried : today;
}

/**
 * The goal's session from the day before when the learner is still in it after midnight (see
 * `isCurrentSession`), or null.
 */
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

/** Whether the learner already started the new day's session (on another screen or device). */
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
