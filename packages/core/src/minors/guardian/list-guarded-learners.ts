import "server-only";
import { prisma } from "@zoonk/db";
import { getMemoryAccess } from "../../memory/_utils/memory-access";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { getSignedInGuardianEmail } from "./_utils/signed-in-account";
import { getWeeklyActivity } from "./_utils/weekly-activity";
import { type GuardedLearnerView } from "./guardian-contract";

/**
 * The learners who made the signed-in account their guardian, with their last seven days and
 * whether their memory is on.
 */
export async function listGuardedLearners(): Promise<GuardedLearnerView[] | null> {
  const guardianEmail = await getSignedInGuardianEmail();

  if (!guardianEmail) {
    return null;
  }

  const [links, { currentDate }] = await Promise.all([
    prisma.guardianLink.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { acceptedAt: "asc" },
      where: { guardianEmail, status: "active" },
    }),
    getRequestProgressDateContext(),
  ]);

  const [activity, memory] = await Promise.all([
    getWeeklyActivity({ today: currentDate, userIds: links.map((link) => link.userId) }),
    Promise.all(links.map((link) => getMemoryAccess(link.userId))),
  ]);

  return links.map((link, index) => ({
    dailyLimitMinutes: link.dailyLimitMinutes,
    learnerName: link.user.name,
    linkId: link.id,
    memoryEnabled: memory[index]?.enabled ?? false,
    memoryOff: link.memoryOff,
    plusApprovedAt: link.plusApprovedAt,
    weeklyActivity: activity.get(link.userId) ?? { days: [], lessonsCompleted: 0, minutes: 0 },
  }));
}
