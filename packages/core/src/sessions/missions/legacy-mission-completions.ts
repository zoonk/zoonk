import { type TransactionClient } from "@zoonk/db";
import { readLegacyMissionCompletions } from "../_utils/session-snapshot";
import { type StudySessionRow } from "../_utils/study-session-access";
import { type Mission } from "../missions";
import { type MissionKind } from "./catalog";
import { type MissionCompletionSource } from "./settle-missions";

/** The mission each activity outside the day's blocks does: the only one it can take credit for. */
const ACTIVITY_MISSIONS: Readonly<Record<string, MissionKind>> = {
  buddyQuestion: "askBuddy",
  conversation: "call",
  mistakePractice: "fixMistake",
  patternDrill: "pattern",
  pronunciationRound: "pronunciation",
};

export function isCompletedBy({
  kind,
  source,
}: {
  kind: MissionKind;
  source: MissionCompletionSource;
}) {
  return ACTIVITY_MISSIONS[source.kind] === kind;
}

/** Old sessions retain dynamic mission selection; only the first completing activity is saved. */
export async function settleLegacyMissions({
  missions,
  session,
  source,
  tx,
}: {
  missions: readonly Mission[];
  session: StudySessionRow;
  source: MissionCompletionSource | undefined;
  tx: TransactionClient;
}) {
  const saved = session.startSnapshot;

  const snapshot =
    saved !== null && typeof saved === "object" && !Array.isArray(saved) ? saved : {};

  if (session.missions !== null || !source) {
    return { claimed: [], snapshot };
  }

  const completions = readLegacyMissionCompletions(saved);

  const claimed = missions.filter(
    (mission) =>
      mission.status === "done" &&
      isCompletedBy({ kind: mission.kind, source }) &&
      !completions.some((completion) => completion.kind === mission.kind),
  );

  if (claimed.length === 0) {
    return { claimed, snapshot };
  }

  const attributed = {
    ...snapshot,
    legacyMissionCompletions: [
      ...completions,
      ...claimed.map((mission) => ({ completedBy: source, kind: mission.kind })),
    ],
  };

  await tx.studySession.update({ data: { startSnapshot: attributed }, where: { id: session.id } });

  return { claimed, snapshot: attributed };
}
