import "server-only";
import { type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { type StudySessionRow } from "../_utils/study-session-access";
import { type Mission } from "../missions";
import { readMissionDocument } from "./catalog";
import { type DayProgressReader, asSavedMission, loadMissionDayViews } from "./mission-day-views";

/** Read-only shared mission projection; never replaces a saved pick. */
export async function getDayMissions({
  session: storedSession,
  displayBlocks,
  timeZone,
  client = prisma,
  readProgress,
  through,
}: {
  session: StudySessionRow;
  /** Today shares its resolved durations so missions and queue use the same content snapshot. */
  displayBlocks?: StudySessionBlock[];
  timeZone: string;
  client?: TransactionClient;
  readProgress?: DayProgressReader;
  through?: Date;
}): Promise<Mission[]> {
  const document = readMissionDocument(storedSession.missions);

  if (!document) {
    return [];
  }

  const blocks = displayBlocks ?? storedSession.blocks;

  const missions = await loadMissionDayViews({
    client,
    picks: document.picks,
    readProgress,
    session: { ...storedSession, blocks },
    through,
    timeZone,
  });

  return missions.map((mission) => asSavedMission(mission));
}
