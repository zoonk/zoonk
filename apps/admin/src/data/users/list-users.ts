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

/**
 * Brain Power remains the default ranking because it highlights the most
 * engaged learners. Newest signups is an alternate operational view for launch
 * follow-up, so it only replaces the primary ranking when the URL asks for it.
 */
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

/**
 * The user table needs the same search shape for both the paginated id query
 * and the total count. Keeping the Prisma filter in one helper prevents the
 * visible page count from drifting away from the rows shown in the table.
 */
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

/**
 * Plan lookup is derived data for the admin table. Keeping it in one helper
 * makes the row mapping a simple projection and keeps the active-subscription
 * rule shared with the detail page.
 */
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
