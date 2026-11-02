import "server-only";
import { prisma } from "@zoonk/db";
import { readMissionDocument } from "../missions/catalog";
import { settleMissions } from "../missions/settle-missions";
import { loadStudySessionView } from "./load-session-view";
import { type PlannedStudyDay } from "./plan-study-day";
import { type StudySessionView } from "./session-view";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

function needsMissionSettlement(session: StudySessionRow, view: StudySessionView): boolean {
  const document = readMissionDocument(session.missions);

  const newProgress = document?.picks.some(
    (pick) =>
      (pick.done ?? 0) < pick.total &&
      view.missions.some((mission) => mission.kind === pick.kind && mission.status === "done"),
  );

  return newProgress === true || (view.fullMeal.ready && !view.fullMeal.earned);
}

/** Learner POST only; avoid tag expiry that would rerender away the current task state. */
export async function loadOpenedDayView({
  initialDay,
  session,
  timeZone,
  userId,
}: {
  initialDay?: PlannedStudyDay;
  session: StudySessionRow;
  timeZone: string;
  userId: string;
}): Promise<StudySessionView> {
  const view = await loadStudySessionView({ initialDay, session, timeZone, userId });

  if (!needsMissionSettlement(session, view)) {
    return view;
  }

  await settleMissions({ revalidation: "skip", sessionId: session.id, timeZone, userId });

  const current = await prisma.studySession.findUniqueOrThrow({
    include: STUDY_SESSION_INCLUDE,
    where: { id: session.id },
  });

  return loadStudySessionView({ session: current, timeZone, userId });
}
