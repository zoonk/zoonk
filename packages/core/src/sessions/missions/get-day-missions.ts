import "server-only";
import { type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { loadPreparingMockPositions } from "../_utils/preparing-mock-blocks";
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
  preparing: knownPreparing,
  through,
}: {
  session: StudySessionRow;
  /** Today shares its resolved durations so missions and queue use the same content snapshot. */
  displayBlocks?: StudySessionBlock[];
  timeZone: string;
  client?: TransactionClient;
  preparing?: ReadonlySet<number>;
  readProgress?: DayProgressReader;
  through?: Date;
}): Promise<Mission[]> {
  const document = readMissionDocument(storedSession.missions);

  if (!document) {
    return [];
  }

  const blocks = displayBlocks ?? storedSession.blocks;

  const preparing =
    knownPreparing ??
    (document.picks.some((pick) => pick.kind === "mock")
      ? await loadPreparingMockPositions({ ...storedSession, blocks })
      : new Set<number>());

  const missions = await loadMissionDayViews({
    client,
    picks: document.picks,
    readProgress,
    session: { ...storedSession, blocks: blocks.filter((block) => !preparing.has(block.position)) },
    through,
    timeZone,
  });

  return missions.map((mission) => asSavedMission(mission));
}
