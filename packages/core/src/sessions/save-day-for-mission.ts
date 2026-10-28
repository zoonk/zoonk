import "server-only";
import { getSession } from "../users/get-session";
import { saveDayBeforeActivity } from "./ensure-study-session";

/** Learner POST only; best-effort save before opening an off-session mission, preserving saved days and refusing unowned/inactive goals. */
export async function saveDayForMission({
  goalId,
  timeZone,
}: {
  goalId: string;
  timeZone?: string;
}): Promise<void> {
  const session = await getSession();

  if (session) {
    await saveDayBeforeActivity({ goalId, timeZone, userId: session.user.id });
  }
}
