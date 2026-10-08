import "server-only";
import { prisma } from "@zoonk/db";
import { getProgressSession } from "./_utils/progress-cache";
import { getRequestProgressDateContext } from "./get-request-date-context";

/**
 * Whether the learner studied on their current day. Learning is what wakes the buddy, so a buddy
 * never naps on a day with study, even while Energy is still low. It reads the same daily totals
 * the buddy's page and Today read.
 */
export async function getStudiedToday(): Promise<boolean> {
  "use cache: private";

  const [session, dateContext] = await Promise.all([
    getProgressSession(),
    getRequestProgressDateContext(),
  ]);

  if (!session) {
    return false;
  }

  const today = await prisma.dailyProgress.findUnique({
    select: { timeSpentSeconds: true },
    where: { userDate: { date: dateContext.currentDate, userId: session.user.id } },
  });

  return (today?.timeSpentSeconds ?? 0) > 0;
}
