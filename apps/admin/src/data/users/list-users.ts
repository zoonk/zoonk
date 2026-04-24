import "server-only";
import { findUserActiveSubscription } from "@/data/users/find-active-subscription";
import { isAdmin } from "@/lib/admin-guard";
import { type Subscription, prisma } from "@zoonk/db";
import { cache } from "react";

const cachedListUsers = cache(async function cachedListUsers(
  limit: number,
  offset: number,
  search?: string,
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

  const userIds = users.map((user) => user.id);

  const subscriptions =
    userIds.length > 0
      ? await prisma.subscription.findMany({
          where: { referenceId: { in: userIds } },
        })
      : [];

  const subscriptionsByUserId = groupSubscriptionsByUser({ subscriptions });

  const usersWithPlan = users.map((user) => ({
    ...user,
    plan: findUserActiveSubscription(subscriptionsByUserId.get(user.id) ?? [])?.plan ?? "free",
  }));

  return { total, users: usersWithPlan };
});

export async function listUsers(params: { limit: number; offset: number; search?: string }) {
  return cachedListUsers(params.limit, params.offset, params.search);
}

/**
 * The user table only needs the subscriptions that belong to each listed user.
 * Grouping them once keeps the render step simple and lets us reuse the same
 * active-subscription selection rule for every row.
 */
function groupSubscriptionsByUser({ subscriptions }: { subscriptions: Subscription[] }) {
  const subscriptionsByUserId = new Map<string, Subscription[]>();

  for (const subscription of subscriptions) {
    const userSubscriptions = subscriptionsByUserId.get(subscription.referenceId) ?? [];
    subscriptionsByUserId.set(subscription.referenceId, [...userSubscriptions, subscription]);
  }

  return subscriptionsByUserId;
}
