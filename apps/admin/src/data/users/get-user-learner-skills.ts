import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

const RECENT_SKILLS = 25;

/**
 * The learner's mastery: how many skills sit in each state, and the most recently practiced
 * skills with their review schedule.
 */
export const getUserLearnerSkills = cacheAdminData(async (userId: string) => {
  const [states, recent] = await Promise.all([
    prisma.learnerSkill.groupBy({ _count: { id: true }, by: ["state"], where: { userId } }),
    prisma.learnerSkill.findMany({
      include: { skill: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: RECENT_SKILLS,
      where: { userId },
    }),
  ]);

  return {
    recent,
    states: states.map((row) => ({ count: row._count.id, state: row.state })),
    total: states.reduce((total, row) => total + row._count.id, 0),
  };
});
