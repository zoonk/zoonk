import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

/**
 * How the learner set Zoonk up (mode, buddy, memory, limits), their birth month and year for the
 * age rules, and their guardian links. Guardian emails are left out: support reads link states.
 */
export const getUserLearningProfile = cacheAdminData(async (userId: string) => {
  const [profile, guardianLinks] = await Promise.all([
    prisma.userLearningProfile.findUnique({
      include: { activeGoal: { select: { id: true, title: true } } },
      omit: { instructions: true, interests: true, preferences: true },
      where: { userId },
    }),
    prisma.guardianLink.findMany({
      omit: { guardianEmail: true, tokenHash: true },
      orderBy: { createdAt: "desc" },
      where: { userId },
    }),
  ]);

  return { guardianLinks, profile };
});
