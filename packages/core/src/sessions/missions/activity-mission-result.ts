import "server-only";
import { loadMissionMoment } from "./mission-moment";
import { type MissionCompletionSource } from "./settle-missions";

/** Preserve activity points; mission rewards belong only to their separate persisted moment. */
export async function withActivityMissionMoment<Result extends object>({
  result,
  source,
  timeZone,
  userId,
}: {
  result: Result;
  source: MissionCompletionSource | null;
  timeZone: string;
  userId: string;
}) {
  const missionMoment = source ? await loadMissionMoment({ source, timeZone, userId }) : null;
  return { ...result, missionMoment };
}
