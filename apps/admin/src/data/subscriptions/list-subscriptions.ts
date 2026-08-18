import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { getSubscriptionOrderBy } from "@/data/subscriptions/_utils/subscription-order";
import { type SubscriptionFilter } from "@/lib/subscription";
import { type Subscription, prisma } from "@zoonk/db";

type SubscriptionUser = Awaited<ReturnType<typeof findSubscriptionUsers>>[number];
type SubscriptionWithUser = Subscription & { user: SubscriptionUser };

const cachedListSubscriptions = cacheAdminData(
  async (filter: SubscriptionFilter, limit: number, offset: number) => {
    const existingUserIds = await findExistingSubscriptionUserIds(filter);

    if (existingUserIds.length === 0) {
      return { subscriptions: [], total: 0 };
    }

    const where = getSubscriptionWhere({ existingUserIds, filter });

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        orderBy: getSubscriptionOrderBy(),
        skip: offset,
        take: limit,
        where,
      }),
      prisma.subscription.count({ where }),
    ]);

    const users = await findSubscriptionUsers({ subscriptions });
    const usersById = new Map(users.map((user) => [user.id, user]));

    const subscriptionsWithUsers = subscriptions
      .map((subscription) => addUserToSubscription({ subscription, usersById }))
      .filter((subscription) => isSubscriptionWithUser(subscription));

    return { subscriptions: subscriptionsWithUsers, total };
  },
);

export type AdminSubscription = Awaited<
  ReturnType<typeof listSubscriptions>
>["subscriptions"][number];

/**
 * The admin subscription log keeps every lifecycle state visible by default,
 * while applying a narrow status condition only when support selects one.
 */
export async function listSubscriptions({
  filter,
  limit,
  offset,
}: {
  filter: SubscriptionFilter;
  limit: number;
  offset: number;
}) {
  return cachedListSubscriptions(filter, limit, offset);
}

function getSubscriptionWhere({
  existingUserIds,
  filter,
}: {
  existingUserIds: string[];
  filter: SubscriptionFilter;
}) {
  const status = filter === "all" ? {} : { status: filter };
  return { referenceId: { in: existingUserIds }, ...status };
}

/**
 * Pagination must run after orphan subscription rows are excluded. Because the
 * Better Auth table does not define a Prisma relation to users, referenced
 * accounts are resolved before the page query and count.
 */
async function findExistingSubscriptionUserIds(filter: SubscriptionFilter) {
  const subscriptionReferences = await prisma.subscription.findMany({
    distinct: ["referenceId"],
    select: { referenceId: true },
    where: filter === "all" ? undefined : { status: filter },
  });

  const users = await findSubscriptionUsers({ subscriptions: subscriptionReferences });

  return users.map((user) => user.id);
}

/**
 * Better Auth stores the user id as `referenceId` instead of a Prisma relation,
 * so subscription rows need one batched account lookup before rendering.
 */
async function findSubscriptionUsers<T extends { referenceId: string }>({
  subscriptions,
}: {
  subscriptions: T[];
}) {
  const userIds = subscriptions.map((subscription) => subscription.referenceId);

  if (userIds.length === 0) {
    return [];
  }

  return prisma.user.findMany({ where: { id: { in: userIds } } });
}

/** Missing users are excluded because the support table requires a valid account link. */
function addUserToSubscription({
  subscription,
  usersById,
}: {
  subscription: Subscription;
  usersById: Map<string, SubscriptionUser>;
}) {
  const user = usersById.get(subscription.referenceId);

  return user ? { ...subscription, user } : null;
}

function isSubscriptionWithUser(
  subscription: SubscriptionWithUser | null,
): subscription is SubscriptionWithUser {
  return subscription !== null;
}
