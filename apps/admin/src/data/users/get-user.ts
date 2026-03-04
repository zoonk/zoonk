import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";

export async function getUser(id: number) {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    return null;
  }

  return prisma.user.findUnique({
    include: {
      _count: { select: { ownedCourses: true } },
      accounts: { select: { providerId: true } },
      members: { include: { organization: { select: { name: true, slug: true } } } },
      progress: true,
      sessions: { orderBy: { updatedAt: "desc" }, select: { updatedAt: true }, take: 1 },
    },
    where: { id },
  });
}
