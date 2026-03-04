import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";

export async function listUsers(params: { limit: number; offset: number; search?: string }) {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    return { total: 0, users: [] };
  }

  const { limit, offset, search } = params;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { username: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      include: {
        sessions: {
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      where,
    }),
    prisma.user.count({ where }),
  ]);

  return { total, users };
}
