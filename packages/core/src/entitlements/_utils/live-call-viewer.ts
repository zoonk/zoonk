import { type TransactionClient } from "@zoonk/db";
import { findActiveSubscriptionForUser } from "../../auth/subscription";
import { type EntitlementViewer } from "./entitlement-viewer";

/** A close can take seconds: tier authorization is read again inside the reservation fence. */
export async function refreshLiveCallViewer({
  isGuest,
  now,
  transaction,
  userId,
}: {
  isGuest: boolean;
  now: Date;
  transaction: TransactionClient;
  userId: string;
}): Promise<EntitlementViewer | null> {
  const user = await transaction.user.findUnique({ where: { id: userId } });

  if (!user) {
    return null;
  }

  if (isGuest || user.isAnonymous) {
    return { isGuest: true, tier: "guest", userId };
  }

  const subscription = await findActiveSubscriptionForUser({ client: transaction, now, userId });
  return { isGuest: false, tier: subscription ? "plus" : "free", userId };
}
