import { getSession } from "../users/get-session";
import { getAppleSubscriptionProduct } from "./apple-products";
import { getAppleSubscriptionFromTransaction } from "./apple-store";
import { AppleStoreError } from "./apple-store-error";
import { AppleSubscriptionError } from "./apple-subscription-error";
import { reconcileAppleSubscription } from "./reconcile-apple-subscription";
import { isActiveStoreSubscription } from "./reconcile-store-subscription";

function getSyncError(error: unknown) {
  if (!(error instanceof AppleStoreError)) {
    return error;
  }

  return new AppleSubscriptionError(error.reason, { cause: error });
}

/** Requires sign-in and a matching signed appAccountToken before granting access. */
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

    return { isActive: isActiveStoreSubscription(subscription), subscription };
  } catch (error) {
    throw getSyncError(error);
  }
}

export { AppleSubscriptionError } from "./apple-subscription-error";
