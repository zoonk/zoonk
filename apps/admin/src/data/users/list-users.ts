import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { findUserActiveSubscription } from "@/data/users/find-active-subscription";
import { type UserSort } from "@/lib/user-sort";
import { type Subscription, prisma } from "@zoonk/db";

const cachedListUsers = cacheAdminData(
  async (limit: number, offset: number, sort: UserSort, search?: string) => {
    const where = getUserSearchWhere({ search });

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        include: { progress: true },
        orderBy: getUserOrderBy({ sort }),
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

function getUserOrderBy({ sort }: { sort: UserSort }) {
  if (sort === "newest-signups") {
    return [{ createdAt: "desc" as const }, { id: "asc" as const }];
  }

  return [
    { progress: { totalBrainPower: "desc" as const } },
    { createdAt: "desc" as const },
    { id: "asc" as const },
  ];
}

function getUserSearchWhere({ search }: { search?: string }) {
  if (!search) {
    return;
  }

  return {
    OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { email: { contains: search, mode: "insensitive" as const } },
      { username: { contains: search, mode: "insensitive" as const } },
    ],
  };
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
