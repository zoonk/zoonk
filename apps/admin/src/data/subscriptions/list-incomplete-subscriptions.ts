import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type Subscription, prisma } from "@zoonk/db";

const INCOMPLETE_SUBSCRIPTION_STATUS = "incomplete";

type SubscriptionUser = Awaited<ReturnType<typeof findSubscriptionUsers>>[number];
type IncompleteSubscriptionWithUser = Subscription & { user: SubscriptionUser };

const cachedListIncompleteSubscriptions = cacheAdminData(async (limit: number, offset: number) => {
  const existingUserIds = await findExistingIncompleteSubscriptionUserIds();

  if (existingUserIds.length === 0) {
    return { subscriptions: [], total: 0 };
  }

  const where = { referenceId: { in: existingUserIds }, status: INCOMPLETE_SUBSCRIPTION_STATUS };

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      orderBy: getIncompleteSubscriptionOrderBy(),
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
    .filter((subscription) => isIncompleteSubscriptionWithUser(subscription));

  return { subscriptions: subscriptionsWithUsers, total };
});

export type IncompleteSubscription = Awaited<
  ReturnType<typeof listIncompleteSubscriptions>
>["subscriptions"][number];

/**
 * The admin subscriptions page needs incomplete checkout records with enough
 * account data to jump into user support from the table.
 */
export async function listIncompleteSubscriptions({
  limit,
  offset,
}: {
  limit: number;
  offset: number;
}) {
  return cachedListIncompleteSubscriptions(limit, offset);
}

/**
 * Incomplete rows often do not have every billing date yet, so nulls should
 * fall behind rows that have real subscription period dates.
 */
function getIncompleteSubscriptionOrderBy() {
  return [
    { periodStart: { nulls: "last" as const, sort: "desc" as const } },
    { periodEnd: { nulls: "last" as const, sort: "desc" as const } },
    { id: "desc" as const },
  ];
}

/**
 * Pagination must run after orphan subscription rows are excluded. Because the
 * Better Auth table does not define a Prisma relation to users, we first find
 * the referenced users that actually exist and then use those ids in the page
 * query and count query.
 */
async function findExistingIncompleteSubscriptionUserIds() {
  const subscriptionReferences = await prisma.subscription.findMany({
    distinct: ["referenceId"],
    select: { referenceId: true },
    where: { status: INCOMPLETE_SUBSCRIPTION_STATUS },
  });

  const users = await findSubscriptionUsers({ subscriptions: subscriptionReferences });

  return users.map((user) => user.id);
}

/**
 * The Better Auth subscription table stores the user id as `referenceId`
 * instead of a Prisma relation, so the page loads those users in one follow-up
 * query after fetching the paginated subscription records.
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

/**
 * User links are required for this support page. If a malformed subscription
 * references a missing user, dropping it avoids rendering a dead account link.
 */
function addUserToSubscription({
  subscription,
  usersById,
}: {
  subscription: Subscription;
  usersById: Map<string, SubscriptionUser>;
}) {
  const user = usersById.get(subscription.referenceId);

  if (!user) {
    return null;
  }

  return { ...subscription, user };
}

/**
 * Filtering through a type guard keeps the public return type as subscriptions
 * that definitely have a user link target.
 */
function isIncompleteSubscriptionWithUser(
  subscription: IncompleteSubscriptionWithUser | null,
): subscription is IncompleteSubscriptionWithUser {
  return subscription !== null;
}
