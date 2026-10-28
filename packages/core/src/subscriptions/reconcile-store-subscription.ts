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
import { StoreSubscriptionChangedError } from "./store-subscription-changed-error";

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

export class StoreSubscriptionConflictError extends Error {
  constructor() {
    super("Store subscription belongs to another account");
    this.name = "StoreSubscriptionConflictError";
  }
}

type ReconcileOptions = {
  /**
   * The row's `providerSignedAt` read before asking a store that signs nothing (Google), or null
   * when there was no row: the snapshot replaces only that version. Without it, signed snapshots
   * (Apple) replace only an older signed time.
   */
  expectedSignedAt?: Date | null;
  /** The chain this one replaced (an upgrade, downgrade or resubscription); it ends as this starts. */
  replacedSubscriptionId?: string | null;
};

type WriteInput = { data: StoreSubscriptionSnapshot & { userId: string }; existing: Subscription };

/**
 * Stores retry notifications and can deliver them out of order, so only a strictly newer
 * snapshot may replace the stored one.
 */
function isStaleSnapshot({ data, existing }: WriteInput) {
  if (data.providerEventId && existing.providerEventId === data.providerEventId) {
    return true;
  }

  return Boolean(existing.providerSignedAt && existing.providerSignedAt >= data.providerSignedAt);
}

/** Preserve the signed-date predicate even when an older external writer races this one. */
async function updateSignedSnapshot(tx: TransactionClient, input: WriteInput) {
  const { data, existing } = input;

  if (isStaleSnapshot(input)) {
    return unchanged(existing);
  }

  const { count } = await tx.subscription.updateMany({
    data,
    where: {
      OR: [{ providerSignedAt: null }, { providerSignedAt: { lt: data.providerSignedAt } }],
      id: existing.id,
    },
  });

  const current = await tx.subscription.findUniqueOrThrow({ where: { id: existing.id } });
  return count === 0 ? unchanged(current) : current;
}

async function updateReadSnapshot(
  tx: TransactionClient,
  { data, existing, expectedSignedAt }: WriteInput & { expectedSignedAt: Date | null },
) {
  const { count } = expectedSignedAt
    ? await tx.subscription.updateMany({
        data,
        where: { id: existing.id, providerSignedAt: expectedSignedAt },
      })
    : { count: 0 };

  if (count === 0) {
    throw new StoreSubscriptionChangedError();
  }

  return tx.subscription.findUniqueOrThrow({ where: { id: existing.id } });
}

/**
 * The replaced chain stops granting access, and its version moves on so a read of it that started
 * earlier can't save it as active again.
 */
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
      providerSignedAt: snapshot.providerSignedAt,
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

function writeSnapshotRow(
  tx: TransactionClient,
  {
    data,
    existing,
    expectedSignedAt,
  }: Omit<WriteInput, "existing"> & {
    existing: Subscription | null;
    expectedSignedAt?: Date | null;
  },
) {
  if (!existing) {
    if (expectedSignedAt) {
      throw new StoreSubscriptionChangedError();
    }

    return tx.subscription.create({ data });
  }

  if (existing.referenceId !== data.referenceId) {
    throw new StoreSubscriptionConflictError();
  }

  return expectedSignedAt === undefined
    ? updateSignedSnapshot(tx, { data, existing })
    : updateReadSnapshot(tx, { data, existing, expectedSignedAt });
}

/** A snapshot and its entitlement/input markers commit together, including first delivery. */
function writeSnapshot(
  snapshot: StoreSubscriptionSnapshot,
  { expectedSignedAt, replacedSubscriptionId }: ReconcileOptions,
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

    const written = await writeSnapshotRow(tx, { data, existing, expectedSignedAt });

    if (replacedSubscriptionId) {
      await endReplacedSubscription({ replacedSubscriptionId, snapshot, tx });
    }

    return written;
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

/**
 * Whether a reconciled store row grants access now. Apple's lapses at its period end; Google keeps
 * a renewing subscription through its renewal (and the silent grace after a failed payment) until
 * a read of it says otherwise (`checkGooglePlayRenewal`), and a canceled one until its period ends.
 */
export function isActiveStoreSubscription(subscription: Subscription, now = new Date()) {
  const isRenewingGooglePlay =
    subscription.provider === "google" && !subscription.cancelAtPeriodEnd;

  return Boolean(
    subscription.status &&
    ["active", "trialing"].includes(subscription.status) &&
    subscription.endedAt === null &&
    (isRenewingGooglePlay || (subscription.periodEnd && subscription.periodEnd > now)),
  );
}
