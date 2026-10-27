import "server-only";
import { getSession } from "../users/get-session";
import { saveDayBeforeActivity } from "./ensure-study-session";

/**
 * The learner tapped one of Today's missions that opens a page of its own (a drill, a round, a
 * call, the notebook's practice): today's day of the goal is saved while that page opens, so the
 * activity there doesn't wait for it, and saves it itself when this didn't get through. A saved
 * day, another learner's or an inactive goal, or a day that offers no missions stays as it is.
 */
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
