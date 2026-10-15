import "server-only";
import { type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getLearnerTimeZone } from "../../learner/_utils/goal-time-zone";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { loadMistakeAvailability } from "../../mistakes/mistake-availability";
import { withLessonDisplayMinutes } from "../_utils/lesson-display-minutes";
import { countMistakesFixedToday, getSessionMissions } from "../_utils/session-missions";
import { type StudySessionRow } from "../_utils/study-session-access";
import { type Mission } from "../missions";
import { readMissionDocument } from "./catalog";
import { asSavedMission, loadMissionDayViews } from "./mission-day-views";

/** One reader for Today, the buddy, summaries and settlement. It never replaces a saved pick. */
export async function getDayMissions({
  session: storedSession,
  displayBlocks,
  readyMistakesOn,
  timeZone,
  client = prisma,
  through,
}: {
  session: StudySessionRow;
  /** Today shares its resolved durations so missions and queue use the same content snapshot. */
  displayBlocks?: StudySessionBlock[];
  /**
   * The goal's mistakes ready to practice on a given day, when the caller reads them anyway (the
   * learner summary), so a day saved without missions doesn't read them twice.
   */
  readyMistakesOn?: (localDate: Date) => Promise<number>;
  timeZone: string;
  client?: TransactionClient;
  through?: Date;
}): Promise<Mission[]> {
  const document = readMissionDocument(storedSession.missions);

  if (!document) {
    if (storedSession.missions !== null) {
      return [];
    }
    // No backfill: pre-deployment sessions retain their original three-kind read contract.
    const [fixedToday, availableMistakes, blocks] = await Promise.all([
      countMistakesFixedToday({
        localDate: storedSession.localDate,
        timeZone,
        userId: storedSession.userId,
      }),
      readyMistakesOn?.(storedSession.localDate) ??
        loadMistakeAvailability({
          goalId: storedSession.goalId,
          localDate: storedSession.localDate,
          timeZone,
          userId: storedSession.userId,
        }).then((availability) => availability.ready),
      displayBlocks ?? withLessonDisplayMinutes({ blocks: storedSession.blocks, client }),
    ]);

    return getSessionMissions({ availableMistakes, blocks, fixedToday });
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
