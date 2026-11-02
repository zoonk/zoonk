import { z } from "zod";
import { GooglePlayError } from "./google-play-error";

export type VerifiedGooglePlaySubscription = {
  /** The Zoonk user the app set as `obfuscatedAccountId`, or that the expired purchase had. */
  accountId: string | null;
  basePlanId: string | null;
  canceledAt: Date | null;
  environment: "production" | "test";
  /** A resubscription from the Play Store: the purchase that expired before it. */
  expiredPurchaseToken: string | null;
  expiryTime: Date;
  isAcknowledged: boolean;
  isActive: boolean;
  isAutoRenewEnabled: boolean;
  /** A resubscription from the Play Store, which carries no account id of its own. */
  isResubscription: boolean;
  linkedPurchaseToken: string | null;
  orderId: string | null;
  productId: string;
  purchaseToken: string;
  readAt: Date;
  startTime: Date;
};

const timestampSchema = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const accountIdentifiersSchema = z
  .object({ obfuscatedExternalAccountId: z.string().optional() })
  .optional();

const subscriptionPurchaseSchema = z.object({
  acknowledgementState: z.string().optional(),
  canceledStateContext: z
    .object({
      userInitiatedCancellation: z.object({ cancelTime: timestampSchema.optional() }).optional(),
    })
    .optional(),
  externalAccountIdentifiers: accountIdentifiersSchema,
  lineItems: z
    .array(
      z.object({
        autoRenewingPlan: z.object({ autoRenewEnabled: z.boolean().optional() }).optional(),
        expiryTime: timestampSchema.optional(),
        latestSuccessfulOrderId: z.string().optional(),
        offerDetails: z.object({ basePlanId: z.string().optional() }).optional(),
        productId: z.string().min(1),
      }),
    )
    .optional(),
  linkedPurchaseToken: z.string().optional(),
  outOfAppPurchaseContext: z
    .object({
      expiredExternalAccountIdentifiers: accountIdentifiersSchema,
      expiredPurchaseToken: z.string().optional(),
    })
    .optional(),
  startTime: timestampSchema.optional(),
  subscriptionState: z.string(),
  testPurchase: z.object({}).optional(),
});

type SubscriptionPurchase = z.infer<typeof subscriptionPurchaseSchema>;

/**
 * Google keeps access while a subscription is active (also through the silent grace after a failed
 * renewal, when its expiry has passed) or in a grace period, and a canceled one until its expiry.
 */
const ENTITLED_STATES = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
]);

/** A purchase still waiting for payment (or whose payment never came) has nothing to grant yet. */
const PENDING_STATES = new Set([
  "SUBSCRIPTION_STATE_PENDING",
  "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED",
]);

/**
 * The account the app set at purchase. A resubscription from the Play Store has none of its own,
 * so it names the account of the purchase that expired before it.
 */
function getAccountId(purchase: SubscriptionPurchase) {
  const accountId =
    purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId ??
    purchase.outOfAppPurchaseContext?.expiredExternalAccountIdentifiers
      ?.obfuscatedExternalAccountId;

  return accountId?.toLowerCase() ?? null;
}

function getCanceledAt({
  isCancelingAtPeriodEnd,
  purchase,
  readAt,
}: {
  isCancelingAtPeriodEnd: boolean;
  purchase: SubscriptionPurchase;
  readAt: Date;
}) {
  if (!isCancelingAtPeriodEnd) {
    return null;
  }

  return purchase.canceledStateContext?.userInitiatedCancellation?.cancelTime ?? readAt;
}

/** Zoonk sells single-item subscriptions, so the first line item is the plan. Null while pending. */
export function createVerifiedGooglePlaySubscription({
  purchaseToken,
  readAt,
  resource,
}: {
  purchaseToken: string;
  readAt: Date;
  resource: unknown;
}): VerifiedGooglePlaySubscription | null {
  const parsed = subscriptionPurchaseSchema.safeParse(resource);

  if (!parsed.success) {
    throw new GooglePlayError("unavailable", { cause: parsed.error });
  }

  const purchase = parsed.data;

  if (PENDING_STATES.has(purchase.subscriptionState)) {
    return null;
  }

  const lineItem = purchase.lineItems?.[0];

  if (!lineItem?.expiryTime || !purchase.startTime) {
    throw new GooglePlayError("invalidPurchase");
  }

  const isActive =
    ENTITLED_STATES.has(purchase.subscriptionState) ||
    (purchase.subscriptionState === "SUBSCRIPTION_STATE_CANCELED" && lineItem.expiryTime > readAt);

  const isAutoRenewEnabled = lineItem.autoRenewingPlan?.autoRenewEnabled ?? false;

  return {
    accountId: getAccountId(purchase),
    basePlanId: lineItem.offerDetails?.basePlanId ?? null,
    canceledAt: getCanceledAt({
      isCancelingAtPeriodEnd: isActive && !isAutoRenewEnabled,
      purchase,
      readAt,
    }),
    environment: purchase.testPurchase ? "test" : "production",
    expiredPurchaseToken: purchase.outOfAppPurchaseContext?.expiredPurchaseToken ?? null,
    expiryTime: lineItem.expiryTime,
    isAcknowledged: purchase.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    isActive,
    isAutoRenewEnabled,
    isResubscription: Boolean(purchase.outOfAppPurchaseContext),
    linkedPurchaseToken: purchase.linkedPurchaseToken ?? null,
    orderId: lineItem.latestSuccessfulOrderId ?? null,
    productId: lineItem.productId,
    purchaseToken,
    readAt,
    startTime: purchase.startTime,
  };
}
