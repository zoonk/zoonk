import "server-only";
import { prisma } from "@zoonk/db";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { getSignedInGuardianEmail } from "./_utils/signed-in-account";
import { getWeeklyActivity } from "./_utils/weekly-activity";
import { type GuardedLearnerView } from "./guardian-contract";

/** The learners who made the signed-in account their guardian, with their last seven days. */
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

  const activity = await getWeeklyActivity({
    today: currentDate,
    userIds: links.map((link) => link.userId),
  });

  return links.map((link) => ({
    dailyLimitMinutes: link.dailyLimitMinutes,
    learnerName: link.user.name,
    linkId: link.id,
    plusApprovedAt: link.plusApprovedAt,
    weeklyActivity: activity.get(link.userId) ?? { days: [], lessonsCompleted: 0, minutes: 0 },
  }));
}
