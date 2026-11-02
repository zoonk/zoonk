import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { hasStartedDay, isCurrentSession } from "../_utils/current-session";
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

/** Replays persisted off-session mission credit; returns null without credit or when now is outside the learner's day. */
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
      where: { missions: { array_contains: [{ completedBy: source }], path: ["picks"] }, userId },
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
    completed: (document?.picks ?? [])
      .filter((pick) => isSource(pick.completedBy, source))
      .map((pick) => pick.kind),
    fullMeal: { bonus: getMissionBonus(missions), paid: paying !== null },
    missions,
  };
}
