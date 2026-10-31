import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

const skillLinkSelect = { id: true, language: true, name: true } as const;

const cachedGetSkill = cacheAdminData(async (skillId: string) =>
  prisma.skill.findUnique({
    include: {
      _count: { select: { chapters: true, items: true, lessons: true } },
      mergedInto: { select: skillLinkSelect },
      mergedSkills: { orderBy: { name: "asc" }, select: skillLinkSelect },
      owner: { select: { email: true, id: true, name: true } },
    },
    where: { id: skillId },
  }),
);

export type AdminSkill = NonNullable<Awaited<ReturnType<typeof getSkill>>>;

export async function getSkill(skillId: string) {
  return cachedGetSkill(skillId);
}
