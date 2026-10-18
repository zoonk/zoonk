import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { hasStartedDay, isCurrentSession } from "../_utils/current-session";
import { readLegacyMissionCompletions } from "../_utils/session-snapshot";
import { STUDY_SESSION_INCLUDE } from "../_utils/study-session-access";
import { type MissionMomentView } from "../completion-contract";
import { getMissionBonus } from "../missions";
import { readMissionDocument } from "./catalog";
import { getDayMissions } from "./get-day-missions";
import { type MissionCompletionSource } from "./settle-missions";

function isSource(
  value: { id: string; kind: string } | undefined,
  source: MissionCompletionSource,
) {
  return value?.id === source.id && value.kind === source.kind;
}

/**
 * What an activity outside the day's blocks (a notebook practice, a pattern drill, a pronunciation
 * round, a call, a question to the buddy) did to the day's missions, for the end of its screen:
 * the missions it completed, the day's missions as they stand, and whether it paid the bonus.
 * Read from what settlement recorded (`completedBy`, `fullMealSource`), so a retry of the same
 * activity says the same. Null when it completed none, and, read again at `now` (a screen that
 * shows it on every visit), once that day is no longer the learner's.
 */
export async function loadMissionMoment({
  now,
  source,
  timeZone,
  userId,
}: {
  now?: Date;
  source: MissionCompletionSource;
  timeZone: string;
  userId: string;
}): Promise<MissionMomentView | null> {
  // The session the activity paid the day's bonus in, when it did; otherwise the latest one whose
  // missions it completed. Legacy sessions keep attribution in the snapshot, retaining their
  // original mission selection instead of backfilling picks from a newer catalog.
  const paying = await prisma.studySession.findFirst({
    include: STUDY_SESSION_INCLUDE,
    orderBy: [{ localDate: "desc" }, { createdAt: "desc" }],
    where: {
      fullMealAt: { not: null },
      startSnapshot: { equals: source, path: ["fullMealSource"] },
      userId,
    },
  });

  const session =
    paying ??
    (await prisma.studySession.findFirst({
      include: STUDY_SESSION_INCLUDE,
      orderBy: [{ localDate: "desc" }, { createdAt: "desc" }],
      where: {
        OR: [
          { missions: { array_contains: [{ completedBy: source }], path: ["picks"] } },
          {
            startSnapshot: {
              array_contains: [{ completedBy: source }],
              path: ["legacyMissionCompletions"],
            },
          },
        ],
        userId,
      },
    }));

  const zone = session?.goal?.timezone ?? timeZone;

  if (!session || (now && !isCurrentSession({ now, session, timeZone: zone }))) {
    return null;
  }

  if (now) {
    const today = getDateInTimeZone({ date: now, timeZone: zone });

    if (
      session.localDate.getTime() !== today.getTime() &&
      (await hasStartedDay({ goalId: session.goalId, localDate: today, userId }))
    ) {
      return null;
    }
  }

  const document = readMissionDocument(session.missions);
  const missions = await getDayMissions({ session, timeZone: zone });

  return {
    completed: (document?.picks ?? readLegacyMissionCompletions(session.startSnapshot))
      .filter((pick) => isSource(pick.completedBy, source))
      .map((pick) => pick.kind),
    fullMeal: { bonus: getMissionBonus(missions), paid: paying !== null },
    missions,
  };
}
