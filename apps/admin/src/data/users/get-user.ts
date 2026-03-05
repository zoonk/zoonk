import "server-only";
import { isAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getUser = cache(async function getUser(id: number) {
  if (!(await isAdmin())) {
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
});
