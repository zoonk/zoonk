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
  endStoreSubscription,
  findStoreSubscription,
  reconcileStoreSubscription,
} from "./reconcile-store-subscription";
import { StoreSubscriptionChangedError } from "./store-subscription-changed-error";

/** A save that keeps racing other writes gives up after this many reads, for its caller to retry. */
const MAX_READS = 3;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

type ReconcileGooglePlaySubscriptionInput = {
  eventId: string | null;
  product: GooglePlaySubscriptionProduct;
  purchase: VerifiedGooglePlaySubscription;
  referenceId: string;
  /** The row as it was before Google was read, or null when there was none. */
  seen: Subscription | null;
};

/** Starts the saved row's renewal workflow; a save outside it schedules one. */
export type ScheduleRenewalCheck = (subscriptionId: string) => Promise<unknown>;

type SaveGooglePlayPurchaseInput = {
  eventId: string | null;
  findOwner: (
    purchase: VerifiedGooglePlaySubscription,
    seen: Subscription | null,
  ) => Promise<string | null>;
  purchaseToken: string;
  scheduleRenewalCheck?: ScheduleRenewalCheck;
};

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
    providerAcknowledged: purchase.isAcknowledged,
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
 * Google blocks replacing a purchase until it's acknowledged, so acknowledging only once it's saved
 * means a replacement always finds its predecessor stored with its owner. The row's renewal check
 * is scheduled first: it retries a failed acknowledgement within Google's three days.
 */
async function save(
  input: ReconcileGooglePlaySubscriptionInput,
  scheduleRenewalCheck: SaveGooglePlayPurchaseInput["scheduleRenewalCheck"],
) {
  const { purchase, seen } = input;

  const subscription = await reconcileStoreSubscription(getGooglePlaySubscriptionSnapshot(input), {
    expectedSignedAt: seen?.providerSignedAt ?? null,
    previousSubscriptionId: purchase.linkedPurchaseToken ?? purchase.expiredPurchaseToken,
  }).catch((error: unknown) => {
    if (error instanceof StoreSubscriptionConflictError) {
      const reason = error.chain === "previous" ? "accountMismatch" : "conflict";
      throw new GooglePlayError(reason, { cause: error });
    }

    throw error;
  });

  if (scheduleRenewalCheck && getGooglePlayRenewalCheckAt(subscription)) {
    await scheduleRenewalCheck(subscription.id);
  }

  if (purchase.isActive && !purchase.isAcknowledged) {
    await acknowledge(input);
  }

  return subscription;
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

async function readGooglePlayPurchase(purchaseToken: string, seen: Subscription | null) {
  try {
    return await getGooglePlaySubscription(purchaseToken);
  } catch (error) {
    if (!(error instanceof GooglePlayError) || error.reason !== "ended") {
      throw error;
    }

    if (!seen) {
      throw new GooglePlayError("invalidPurchase", { cause: error });
    }

    return "ended" as const;
  }
}

async function readAndSave(input: SaveGooglePlayPurchaseInput, seen: Subscription | null) {
  const purchase = await readGooglePlayPurchase(input.purchaseToken, seen);

  if (purchase === "ended") {
    return seen && !seen.endedAt ? endStoreSubscription(seen) : seen;
  }

  if (!purchase) {
    return null;
  }

  const product = getGooglePlaySubscriptionProduct(purchase);

  if (!product) {
    throw new GooglePlayError("invalidProduct");
  }

  const referenceId = await input.findOwner(purchase, seen);

  if (!referenceId) {
    return null;
  }

  return save(
    { eventId: input.eventId, product, purchase, referenceId, seen },
    input.scheduleRenewalCheck,
  );
}

/**
 * Google signs no version, so a save replaces only the row read before asking Google, and reads
 * Google again when another save landed in between. `findOwner` returning null saves nothing. A
 * stored purchase Google answers with 410 is ended.
 */
export async function saveGooglePlayPurchase(
  input: SaveGooglePlayPurchaseInput,
  read = 1,
): Promise<Subscription | null> {
  const seen = await findStoreSubscription({
    provider: "google",
    providerSubscriptionId: input.purchaseToken,
  });

  const { data, error } = await safeAsync(() => readAndSave(input, seen));

  if (!(error instanceof StoreSubscriptionChangedError)) {
    if (error) {
      throw error;
    }

    return data;
  }

  if (read === MAX_READS) {
    throw new GooglePlayError("unavailable", { cause: error });
  }

  return saveGooglePlayPurchase(input, read + 1);
}

/**
 * The renewal workflow's one checkpoint rule, after a check or a failed one alike: within the hour
 * while Google waits for an acknowledgement, at the period end, then a day at a time while Google
 * still calls a lapsed period active (the silent grace while it retries a payment). Null once
 * Google has ended it.
 */
export function getGooglePlayRenewalCheckAt(subscription: Subscription | null, now = new Date()) {
  if (subscription?.status !== "active" || subscription.endedAt || !subscription.periodEnd) {
    return null;
  }

  const { periodEnd } = subscription;

  if (!subscription.providerAcknowledged) {
    return new Date(now.getTime() + HOUR_MS);
  }

  if (periodEnd > now) {
    return periodEnd;
  }

  const days = Math.floor((now.getTime() - periodEnd.getTime()) / DAY_MS) + 1;
  return new Date(periodEnd.getTime() + days * DAY_MS);
}
