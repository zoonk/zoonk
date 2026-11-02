import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { type SubscriptionFilter } from "@/lib/subscription";
import { type Subscription, prisma, sql } from "@zoonk/db";

type SubscriptionUser = Awaited<ReturnType<typeof findSubscriptionUsers>>[number];
type SubscriptionWithUser = Subscription & { user: SubscriptionUser };
type SubscriptionPageReference = Pick<Subscription, "id" | "referenceId">;

const cachedListSubscriptions = cacheAdminData(
  async (filter: SubscriptionFilter, limit: number, offset: number) => {
    const [pageReferences, total] = await Promise.all([
      findSubscriptionPageReferences({ filter, limit, offset }),
      countUserSubscriptions(filter),
    ]);

    if (pageReferences.length === 0) {
      return { subscriptions: [], total };
    }

    const [subscriptionRows, users] = await Promise.all([
      prisma.subscription.findMany({ where: { id: { in: getSubscriptionIds(pageReferences) } } }),
      findSubscriptionUsers({ subscriptions: pageReferences }),
    ]);

    const subscriptions = orderSubscriptionsByPage({
      pageReferences,
      subscriptions: subscriptionRows,
    });

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

/** The subscriptions table has no Prisma user relation, so users are joined in SQL for the page only. */
async function findSubscriptionPageReferences({
  filter,
  limit,
  offset,
}: {
  filter: SubscriptionFilter;
  limit: number;
  offset: number;
}) {
  const whereCondition = getSubscriptionWhereCondition(filter);

  return prisma.$queryRaw<SubscriptionPageReference[]>`
    SELECT subscriptions.id, subscriptions.reference_id AS "referenceId"
    FROM subscriptions
    INNER JOIN users ON users.id = subscriptions.reference_id
    WHERE ${whereCondition}
    ORDER BY
      subscriptions.period_start DESC NULLS LAST,
      subscriptions.period_end DESC NULLS LAST,
      subscriptions.id DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
}

async function countUserSubscriptions(filter: SubscriptionFilter) {
  const whereCondition = getSubscriptionWhereCondition(filter);

  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) AS count
    FROM subscriptions
    INNER JOIN users ON users.id = subscriptions.reference_id
    WHERE ${whereCondition}
  `;

  return Number(result[0].count);
}

function getSubscriptionWhereCondition(filter: SubscriptionFilter) {
  return sql`${trackedAnalyticsUserSql} AND ${getSubscriptionStatusCondition(filter)}`;
}

function getSubscriptionStatusCondition(filter: SubscriptionFilter) {
  return filter === "all" ? sql`TRUE` : sql`subscriptions.status = ${filter}`;
}

function getSubscriptionIds(pageReferences: SubscriptionPageReference[]) {
  return pageReferences.map((subscription) => subscription.id);
}

function orderSubscriptionsByPage({
  pageReferences,
  subscriptions,
}: {
  pageReferences: SubscriptionPageReference[];
  subscriptions: Subscription[];
}) {
  const subscriptionsById = new Map(
    subscriptions.map((subscription) => [subscription.id, subscription]),
  );

  return pageReferences
    .map((subscription) => subscriptionsById.get(subscription.id))
    .filter((subscription) => isSubscription(subscription));
}

function isSubscription(subscription: Subscription | undefined): subscription is Subscription {
  return subscription !== undefined;
}

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
