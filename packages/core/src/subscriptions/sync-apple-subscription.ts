import { type Subscription } from "@zoonk/db";
import { getSession } from "../users/get-session";
import { getAppleSubscriptionProduct } from "./apple-products";
import { getAppleSubscriptionFromTransaction } from "./apple-store";
import { AppleStoreError } from "./apple-store-error";
import { AppleSubscriptionError } from "./apple-subscription-error";
import { reconcileAppleSubscription } from "./reconcile-apple-subscription";

function getSyncError(error: unknown) {
  if (!(error instanceof AppleStoreError)) {
    return error;
  }

  return new AppleSubscriptionError(error.reason, { cause: error });
}

function isActiveAppleSubscription(subscription: Subscription) {
  return Boolean(
    subscription.provider === "apple" &&
    subscription.status &&
    ["active", "trialing"].includes(subscription.status) &&
    subscription.endedAt === null &&
    subscription.periodEnd &&
    subscription.periodEnd > new Date(),
  );
}

/**
 * Derives ownership from the authenticated session and requires Apple's signed appAccountToken
 * to match before granting cross-platform access.
 */
export async function syncCurrentUserAppleSubscription({
  signedTransaction,
}: {
  signedTransaction: string;
}) {
  const session = await getSession();

  if (!session) {
    throw new AppleSubscriptionError("unauthorized");
  }

  try {
    const verifiedSubscription = await getAppleSubscriptionFromTransaction({ signedTransaction });

    if (verifiedSubscription.accountToken?.toLowerCase() !== session.user.id.toLowerCase()) {
      throw new AppleSubscriptionError("accountMismatch");
    }

    const product = getAppleSubscriptionProduct(verifiedSubscription.productId);

    if (!product) {
      throw new AppleSubscriptionError("invalidProduct");
    }

    const subscription = await reconcileAppleSubscription({
      product,
      referenceId: session.user.id,
      verifiedSubscription,
    });

    return { isActive: isActiveAppleSubscription(subscription), subscription };
  } catch (error) {
    throw getSyncError(error);
  }
}

export { AppleSubscriptionError } from "./apple-subscription-error";
