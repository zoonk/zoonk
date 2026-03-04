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
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      where,
    }),
    prisma.user.count({ where }),
  ]);

  const userIds = users.map((user) => String(user.id));

  const subscriptions =
    userIds.length > 0
      ? await prisma.subscription.findMany({
          distinct: ["referenceId"],
          orderBy: { id: "desc" },
          select: { plan: true, referenceId: true },
          where: { referenceId: { in: userIds } },
        })
      : [];

  const subscriptionByUserId = new Map(subscriptions.map((sub) => [sub.referenceId, sub.plan]));

  const usersWithPlan = users.map((user) => ({
    ...user,
    plan: subscriptionByUserId.get(String(user.id)) ?? "free",
  }));

  return { total, users: usersWithPlan };
}
