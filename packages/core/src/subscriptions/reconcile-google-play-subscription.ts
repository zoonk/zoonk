import { type Subscription } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { acknowledgeGooglePlaySubscription, getGooglePlaySubscription } from "./google-play-api";
import { GooglePlayError } from "./google-play-error";
import {
  type GooglePlaySubscriptionProduct,
  getGooglePlaySubscriptionProduct,
} from "./google-play-products";
import { type VerifiedGooglePlaySubscription } from "./google-play-purchase";
import {
  StoreSubscriptionConflictError,
  type StoreSubscriptionSnapshot,
  findStoreSubscription,
  reconcileStoreSubscription,
} from "./reconcile-store-subscription";
import { StoreSubscriptionChangedError } from "./store-subscription-changed-error";

/** A save that keeps racing other writes gives up after this many reads, for its caller to retry. */
const MAX_READS = 3;
const DAY_MS = 86_400_000;

type ReconcileGooglePlaySubscriptionInput = {
  eventId: string | null;
  product: GooglePlaySubscriptionProduct;
  purchase: VerifiedGooglePlaySubscription;
  referenceId: string;
  /** The row as it was before Google was read, or null when there was none. */
  seen: Subscription | null;
};

type FindOwner = (
  purchase: VerifiedGooglePlaySubscription,
  seen: Subscription | null,
) => Promise<string | null>;

function getGooglePlaySubscriptionSnapshot({
  eventId,
  product,
  purchase,
  referenceId,
}: Omit<ReconcileGooglePlaySubscriptionInput, "seen">): StoreSubscriptionSnapshot {
  const cancelAtPeriodEnd = purchase.isActive && !purchase.isAutoRenewEnabled;

  return {
    billingInterval: product.billingInterval,
    cancelAt: cancelAtPeriodEnd ? purchase.expiryTime : null,
    cancelAtPeriodEnd,
    canceledAt: purchase.canceledAt,
    /** Revocation, hold and pause end access now even when the period would have run longer. */
    endedAt: purchase.isActive
      ? null
      : new Date(Math.min(purchase.expiryTime.getTime(), purchase.readAt.getTime())),
    periodEnd: purchase.expiryTime,
    periodStart: purchase.startTime,
    plan: product.plan,
    provider: "google",
    providerEnvironment: purchase.environment,
    providerEventId: eventId,
    providerProductId: purchase.basePlanId
      ? `${purchase.productId}:${purchase.basePlanId}`
      : purchase.productId,
    providerSignedAt: purchase.readAt,
    providerSubscriptionId: purchase.purchaseToken,
    providerTransactionId: purchase.orderId,
    referenceId,
    status: purchase.isActive ? "active" : "canceled",
  };
}

/**
 * The app's POST and the purchase notification arrive together, so both may acknowledge one
 * purchase; when Google refuses the second, the purchase is already acknowledged. A resubscription
 * from the Play Store gets its owner's account id, which its later resubscriptions then carry.
 */
async function acknowledge({ purchase, referenceId }: ReconcileGooglePlaySubscriptionInput) {
  const { error } = await safeAsync(() =>
    acknowledgeGooglePlaySubscription({
      accountId: purchase.isResubscription ? referenceId : undefined,
      productId: purchase.productId,
      purchaseToken: purchase.purchaseToken,
    }),
  );

  if (!error) {
    return;
  }

  const current = await getGooglePlaySubscription(purchase.purchaseToken);

  if (!current?.isAcknowledged) {
    throw error;
  }
}

/**
 * Acknowledges a granted purchase before saving it, so a saved notification never hides an
 * acknowledgement that failed: a retry reads the purchase again and acknowledges what's left.
 * Google signs no version, so the save replaces only the row read before asking it.
 */
async function save(input: ReconcileGooglePlaySubscriptionInput) {
  const { purchase, seen } = input;

  if (purchase.isActive && !purchase.isAcknowledged) {
    await acknowledge(input);
  }

  try {
    return await reconcileStoreSubscription(getGooglePlaySubscriptionSnapshot(input), {
      expectedSignedAt: seen?.providerSignedAt ?? null,
      replacedSubscriptionId: purchase.isActive ? purchase.linkedPurchaseToken : null,
    });
  } catch (error) {
    if (error instanceof StoreSubscriptionConflictError) {
      throw new GooglePlayError("conflict", { cause: error });
    }

    throw error;
  }
}

/**
 * The account a purchase line belongs to: the stored owner of the purchase this one replaced or
 * resubscribed, else the account Google names. When both exist they must agree, so one purchase
 * line never gives Plus to two learners (a replacement bought under another account is refused).
 */
export async function findGooglePlayLineOwner(purchase: VerifiedGooglePlaySubscription) {
  const previousToken = purchase.linkedPurchaseToken ?? purchase.expiredPurchaseToken;

  const previous = previousToken
    ? await findStoreSubscription({ provider: "google", providerSubscriptionId: previousToken })
    : null;

  if (previous && purchase.accountId && previous.referenceId !== purchase.accountId) {
    throw new GooglePlayError("accountMismatch");
  }

  return previous?.referenceId ?? purchase.accountId;
}

/**
 * Google signs no version, so a save replaces only the row read before asking Google, and reads
 * Google again when another save landed in between. `findOwner` returning null saves nothing.
 */
export async function saveGooglePlayPurchase(
  {
    eventId,
    findOwner,
    purchaseToken,
  }: { eventId: string | null; findOwner: FindOwner; purchaseToken: string },
  read = 1,
): Promise<Subscription | null> {
  const seen = await findStoreSubscription({
    provider: "google",
    providerSubscriptionId: purchaseToken,
  });

  /** Pub/Sub delivers at least once: a message already saved needs no second read from Google. */
  if (eventId && seen?.providerEventId === eventId) {
    return seen;
  }

  const purchase = await getGooglePlaySubscription(purchaseToken);

  if (!purchase) {
    return null;
  }

  const product = getGooglePlaySubscriptionProduct(purchase);

  if (!product) {
    throw new GooglePlayError("invalidProduct");
  }

  const referenceId = await findOwner(purchase, seen);

  if (!referenceId) {
    return null;
  }

  const { data, error } = await safeAsync(() =>
    save({ eventId, product, purchase, referenceId, seen }),
  );

  if (!(error instanceof StoreSubscriptionChangedError)) {
    if (error) {
      throw error;
    }

    return data;
  }

  if (read === MAX_READS) {
    throw new GooglePlayError("unavailable", { cause: error });
  }

  return saveGooglePlayPurchase({ eventId, findOwner, purchaseToken }, read + 1);
}

/**
 * When to read a saved purchase from Google again: at its period end, when it renews, ends or goes
 * into grace, or a day on while Google still calls a lapsed period active (the silent grace while
 * it retries a payment). Null once Google has ended it.
 */
export function getGooglePlayRenewalCheckAt(subscription: Subscription | null, now = new Date()) {
  if (subscription?.status !== "active" || subscription.endedAt || !subscription.periodEnd) {
    return null;
  }

  const { periodEnd } = subscription;

  if (periodEnd > now) {
    return periodEnd;
  }

  const days = Math.floor((now.getTime() - periodEnd.getTime()) / DAY_MS) + 1;
  return new Date(periodEnd.getTime() + days * DAY_MS);
}

export function getGooglePlayRenewalCheck(subscription: Subscription | null) {
  const checkAt = getGooglePlayRenewalCheckAt(subscription);
  return checkAt && subscription ? { checkAt, subscriptionId: subscription.id } : null;
}
