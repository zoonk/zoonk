import {
  type Subscription,
  type TransactionClient,
  isPrismaUniqueConstraintError,
  prisma,
} from "@zoonk/db";
import { z } from "zod";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getUserSubscriptionCacheTag } from "../cache/tags";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";

type StoreProvider = "apple" | "google";

/** One store's view of a subscription chain at `providerSignedAt`, owned by `referenceId`. */
export type StoreSubscriptionSnapshot = {
  billingInterval: "month" | "year";
  cancelAt: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  endedAt: Date | null;
  periodEnd: Date;
  periodStart: Date;
  plan: "plus";
  provider: StoreProvider;
  providerEnvironment: string;
  providerEventId: string | null;
  providerProductId: string;
  providerSignedAt: Date;
  providerSubscriptionId: string;
  providerTransactionId: string | null;
  referenceId: string;
  status: "active" | "canceled";
};

/** The store chain is already linked to another Zoonk account. */
export class StoreSubscriptionConflictError extends Error {
  constructor() {
    super("Store subscription belongs to another account");
    this.name = "StoreSubscriptionConflictError";
  }
}

/**
 * Stores retry notifications and can deliver them out of order, so only a strictly newer
 * snapshot may replace the stored one.
 */
function isStaleSnapshot({
  existing,
  snapshot,
}: {
  existing: Subscription;
  snapshot: StoreSubscriptionSnapshot;
}) {
  if (snapshot.providerEventId && existing.providerEventId === snapshot.providerEventId) {
    return true;
  }

  return Boolean(
    existing.providerSignedAt && existing.providerSignedAt >= snapshot.providerSignedAt,
  );
}

type ReconcileOptions = {
  /** The chain this one replaced (an upgrade, downgrade or resubscription); it ends as this starts. */
  replacedSubscriptionId?: string | null;
};

function endReplacedSubscription({
  replacedSubscriptionId,
  snapshot,
  tx,
}: {
  replacedSubscriptionId: string;
  snapshot: StoreSubscriptionSnapshot;
  tx: TransactionClient;
}) {
  return tx.subscription.updateMany({
    data: {
      cancelAt: null,
      cancelAtPeriodEnd: false,
      endedAt: snapshot.periodStart,
      status: "canceled",
    },
    where: {
      endedAt: null,
      provider: snapshot.provider,
      providerSubscriptionId: replacedSubscriptionId,
      referenceId: snapshot.referenceId,
    },
  });
}

/** A snapshot and its entitlement/input markers commit together, including first delivery. */
function writeSnapshot(
  snapshot: StoreSubscriptionSnapshot,
  { replacedSubscriptionId }: ReconcileOptions,
) {
  const data = { ...snapshot, userId: snapshot.referenceId };

  return writeLearnerChange({ planInputs: true, userId: snapshot.referenceId }, async (tx) => {
    const existing = await tx.subscription.findUnique({
      where: {
        provider_providerSubscriptionId: {
          provider: snapshot.provider,
          providerSubscriptionId: snapshot.providerSubscriptionId,
        },
      },
    });

    if (!existing) {
      if (replacedSubscriptionId) {
        await endReplacedSubscription({ replacedSubscriptionId, snapshot, tx });
      }

      return tx.subscription.create({ data });
    }

    if (existing.referenceId !== snapshot.referenceId) {
      throw new StoreSubscriptionConflictError();
    }

    if (isStaleSnapshot({ existing, snapshot })) {
      return unchanged(existing);
    }

    /** Preserve the signed-date predicate even when an older external writer races this one. */
    const { count } = await tx.subscription.updateMany({
      data,
      where: {
        OR: [{ providerSignedAt: null }, { providerSignedAt: { lt: snapshot.providerSignedAt } }],
        id: existing.id,
      },
    });

    const current = await tx.subscription.findUniqueOrThrow({ where: { id: existing.id } });
    return count === 0 ? unchanged(current) : current;
  });
}

export function findStoreSubscription({
  provider,
  providerSubscriptionId,
}: {
  provider: StoreProvider;
  providerSubscriptionId: string;
}) {
  return prisma.subscription.findUnique({
    where: { provider_providerSubscriptionId: { provider, providerSubscriptionId } },
  });
}

/**
 * Who a notification's chain belongs to: a known chain keeps its owner, and a first delivery may
 * create a row only for the account the store names, while that user still exists.
 */
export async function findNotificationOwner({
  accountId,
  existingReferenceId,
}: {
  accountId: string | null;
  existingReferenceId: string | null;
}) {
  if (existingReferenceId) {
    return existingReferenceId;
  }

  if (!accountId || !z.uuid().safeParse(accountId).success) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: accountId } });
  return user?.id ?? null;
}

/** Persists one ordered store snapshot and expires every cached entitlement derived from it. */
export async function reconcileStoreSubscription(
  snapshot: StoreSubscriptionSnapshot,
  options: ReconcileOptions = {},
) {
  const subscription = await writeSnapshot(snapshot, options).catch((error: unknown) => {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    /** A different account can race the provider-chain key: retry after the losing tx rolled back. */
    return writeSnapshot(snapshot, options);
  });

  revalidateCacheTags([getUserSubscriptionCacheTag(snapshot.referenceId)]);
  return subscription;
}

/** Whether a reconciled store row grants access right now (stores bound access by its period). */
export function isActiveStoreSubscription(subscription: Subscription) {
  return Boolean(
    subscription.status &&
    ["active", "trialing"].includes(subscription.status) &&
    subscription.endedAt === null &&
    subscription.periodEnd &&
    subscription.periodEnd > new Date(),
  );
}
