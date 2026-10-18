import "server-only";
import { loadMissionMoment } from "./mission-moment";
import { type MissionCompletionSource } from "./settle-missions";

/**
 * Keep an off-session activity's own result (including its earned Brain Power) unchanged.
 * Mission rewards belong only to the separately persisted mission moment, never to activity points.
 */
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
