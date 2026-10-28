import { z } from "zod";
import { GooglePlayError } from "./google-play-error";

export type VerifiedGooglePlaySubscription = {
  /** The Zoonk user the app set as `obfuscatedAccountId`, or that the expired purchase had. */
  accountId: string | null;
  basePlanId: string | null;
  canceledAt: Date | null;
  environment: "production" | "test";
  expiryTime: Date;
  /** The purchase has no account id of its own: a resubscription from the Play Store. */
  hasOwnAccountId: boolean;
  isAcknowledged: boolean;
  isActive: boolean;
  isAutoRenewEnabled: boolean;
  linkedPurchaseToken: string | null;
  orderId: string | null;
  productId: string;
  purchaseToken: string;
  /** When Zoonk read this state from Google, which orders concurrent reads of one token. */
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
    .object({ expiredExternalAccountIdentifiers: accountIdentifiersSchema })
    .optional(),
  startTime: timestampSchema.optional(),
  subscriptionState: z.string(),
  testPurchase: z.object({}).optional(),
});

type SubscriptionPurchase = z.infer<typeof subscriptionPurchaseSchema>;

/** Google keeps access through a grace period and until a canceled period ends; never on hold or paused. */
const ENTITLED_STATES = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_CANCELED",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
]);

/** A purchase still waiting for payment (or whose payment never came) has nothing to grant yet. */
const PENDING_STATES = new Set([
  "SUBSCRIPTION_STATE_PENDING",
  "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED",
]);

/** Account ids are Zoonk user ids; anything else can't name an account. */
function getAccountId(value: string | undefined) {
  const result = z.uuid().safeParse(value);
  return result.success ? result.data.toLowerCase() : null;
}

/**
 * The account the app set at purchase. A resubscription from the Play Store has none of its own,
 * so it names the account of the purchase that expired before it.
 */
function getPurchaseAccount(purchase: SubscriptionPurchase) {
  const ownAccountId = purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  const expiredIdentifiers = purchase.outOfAppPurchaseContext?.expiredExternalAccountIdentifiers;

  return {
    accountId:
      getAccountId(ownAccountId) ?? getAccountId(expiredIdentifiers?.obfuscatedExternalAccountId),
    hasOwnAccountId: Boolean(ownAccountId),
  };
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

/**
 * Converts a `purchases.subscriptionsv2` resource into the entitlement Zoonk stores. Returns null
 * for a pending purchase. Zoonk sells single-item subscriptions, so the first line item is the plan.
 */
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

  const isActive = ENTITLED_STATES.has(purchase.subscriptionState) && lineItem.expiryTime > readAt;
  const isAutoRenewEnabled = lineItem.autoRenewingPlan?.autoRenewEnabled ?? false;

  return {
    ...getPurchaseAccount(purchase),
    basePlanId: lineItem.offerDetails?.basePlanId ?? null,
    canceledAt: getCanceledAt({
      isCancelingAtPeriodEnd: isActive && !isAutoRenewEnabled,
      purchase,
      readAt,
    }),
    environment: purchase.testPurchase ? "test" : "production",
    expiryTime: lineItem.expiryTime,
    isAcknowledged: purchase.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    isActive,
    isAutoRenewEnabled,
    linkedPurchaseToken: purchase.linkedPurchaseToken ?? null,
    orderId: lineItem.latestSuccessfulOrderId ?? null,
    productId: lineItem.productId,
    purchaseToken,
    readAt,
    startTime: purchase.startTime,
  };
}
