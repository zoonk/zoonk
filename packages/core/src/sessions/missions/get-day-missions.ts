import "server-only";
import { type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getLearnerTimeZone } from "../../learner/_utils/goal-time-zone";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { withLessonDisplayMinutes } from "../_utils/lesson-display-minutes";
import { type StudySessionRow } from "../_utils/study-session-access";
import { type Mission } from "../missions";
import { readMissionDocument } from "./catalog";
import { asSavedMission, loadMissionDayViews } from "./mission-day-views";

/** Read-only shared mission projection; never replaces a saved pick. */
export async function getDayMissions({
  session: storedSession,
  displayBlocks,
  timeZone,
  client = prisma,
  through,
}: {
  session: StudySessionRow;
  /** Today shares its resolved durations so missions and queue use the same content snapshot. */
  displayBlocks?: StudySessionBlock[];
  timeZone: string;
  client?: TransactionClient;
  through?: Date;
}): Promise<Mission[]> {
  const document = readMissionDocument(storedSession.missions);

  if (!document) {
    return [];
  }

  const blocks =
    displayBlocks ?? (await withLessonDisplayMinutes({ blocks: storedSession.blocks, client }));

  const missions = await loadMissionDayViews({
    client,
    picks: document.picks,
    session: { ...storedSession, blocks },
    through,
    timeZone,
  });

  return missions.map((mission) => asSavedMission(mission));
}

/** The bonus belongs to the learner's day across all goals. */
export async function hasDayMissionBonus({
  session,
  client = prisma,
  now,
  timeZone,
}: {
  session: Pick<StudySessionRow, "fullMealAt" | "localDate" | "userId">;
  client?: TransactionClient;
  now?: Date;
  timeZone?: string;
}): Promise<boolean> {
  if (session.fullMealAt !== null) {
    return true;
  }

  if (now) {
    const zone = await getLearnerTimeZone({ timeZone, userId: session.userId });
    const day = getDateInTimeZone({ date: now, timeZone: zone });
    const from = getStartOfLocalDay({ localDate: day, timeZone: zone });

    const to = getStartOfLocalDay({
      localDate: new Date(day.getTime() + MS_PER_DAY),
      timeZone: zone,
    });

    const paid = await client.studySession.count({
      where: { fullMealAt: { gte: from, lt: to }, userId: session.userId },
    });

    return paid > 0;
  }

  return (
    (await client.studySession.count({
      where: { fullMealAt: { not: null }, localDate: session.localDate, userId: session.userId },
    })) > 0
  );
}
