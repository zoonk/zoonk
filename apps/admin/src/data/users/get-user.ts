import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

const cachedGetUser = cacheAdminData(async (id: string) =>
  prisma.user.findUnique({
    include: {
      _count: { select: { ownedCourses: true } },
      accounts: { select: { providerId: true } },
      members: { include: { organization: { select: { name: true, slug: true } } } },
      progress: true,
      sessions: { orderBy: { updatedAt: "desc" }, select: { updatedAt: true }, take: 1 },
    },
    where: { id },
  }),
);

export async function getUser(id: string) {
  "use cache: private";

  return cachedGetUser(id);
}
