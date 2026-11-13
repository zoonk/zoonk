import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { findUserActiveSubscription } from "@/data/users/find-active-subscription";
import { type UserSort } from "@/lib/user-sort";
import { getUserSearchWhere } from "@zoonk/core/users/user-search";
import { type Subscription, prisma } from "@zoonk/db";

const cachedListUsers = cacheAdminData(
  async (limit: number, offset: number, sort: UserSort, search?: string) => {
    const where = getUserSearchWhere({ search });

    const [users, total] = await Promise.all([
      sort === "brain-power"
        ? findUsersByBrainPower({ limit, offset, where })
        : prisma.user.findMany({
            include: { progress: true },
            orderBy: NEWEST_FIRST,
            skip: offset,
            take: limit,
            where,
          }),
      prisma.user.count({ where }),
    ]);

    const userIds = users.map((user) => user.id);

    const subscriptions =
      userIds.length > 0
        ? await prisma.subscription.findMany({ where: { referenceId: { in: userIds } } })
        : [];

    const subscriptionsByUserId = groupSubscriptionsByUser({ subscriptions });

    const usersWithPlan = users.map((user) => addUserPlan({ subscriptionsByUserId, user }));

    return { total, users: usersWithPlan };
  },
);

export async function listUsers(params: {
  limit: number;
  offset: number;
  search?: string;
  sort: UserSort;
}) {
  return cachedListUsers(params.limit, params.offset, params.sort, params.search);
}

const NEWEST_FIRST = [{ createdAt: "desc" as const }, { id: "asc" as const }];

/**
 * Postgres sorts a missing progress row above every number, so a plain descending order would open
 * the list with the users who never earned any. They follow the ranked ones here, newest first.
 */
async function findUsersByBrainPower({
  limit,
  offset,
  where,
}: {
  limit: number;
  offset: number;
  where: ReturnType<typeof getUserSearchWhere>;
}) {
  const ranked = { ...where, progress: { isNot: null } };

  const rankedUsers = await prisma.user.findMany({
    include: { progress: true },
    orderBy: [{ progress: { totalBrainPower: "desc" } }, ...NEWEST_FIRST],
    skip: offset,
    take: limit,
    where: ranked,
  });

  if (rankedUsers.length === limit) {
    return rankedUsers;
  }

  const rankedTotal = await prisma.user.count({ where: ranked });

  const unrankedUsers = await prisma.user.findMany({
    include: { progress: true },
    orderBy: NEWEST_FIRST,
    skip: Math.max(0, offset - rankedTotal),
    take: limit - rankedUsers.length,
    where: { ...where, progress: null },
  });

  return [...rankedUsers, ...unrankedUsers];
}

function addUserPlan<TUser extends { id: string }>({
  subscriptionsByUserId,
  user,
}: {
  subscriptionsByUserId: Map<string, Subscription[]>;
  user: TUser;
}) {
  return {
    ...user,
    plan: findUserActiveSubscription(subscriptionsByUserId.get(user.id) ?? [])?.plan ?? "free",
  };
}

function groupSubscriptionsByUser({ subscriptions }: { subscriptions: Subscription[] }) {
  const subscriptionsByUserId = new Map<string, Subscription[]>();

  for (const subscription of subscriptions) {
    const userSubscriptions = subscriptionsByUserId.get(subscription.referenceId) ?? [];
    subscriptionsByUserId.set(subscription.referenceId, [...userSubscriptions, subscription]);
  }

  return subscriptionsByUserId;
}
