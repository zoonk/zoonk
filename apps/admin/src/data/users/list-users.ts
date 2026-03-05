import "server-only";
import { isAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { cache } from "react";

const cachedListUsers = cache(async function cachedListUsers(
  limit: number,
  offset: number,
  search: string | undefined,
) {
  if (!(await isAdmin())) {
    return { total: 0, users: [] };
  }

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
});

export async function listUsers(params: { limit: number; offset: number; search?: string }) {
  return cachedListUsers(params.limit, params.offset, params.search);
}
