import {
  Environment,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type LastTransactionsItem,
  NotificationTypeV2,
  type SignedDataVerifier,
  VerificationException,
  VerificationStatus,
} from "@apple/app-store-server-library";
import { getAppStoreServerClient, getSignedDataVerifier } from "./apple-store-config";
import { AppleStoreError } from "./apple-store-error";
import { createVerifiedAppleSubscription, getSignedDate } from "./apple-store-payload";

function toAppleStoreError(error: unknown) {
  if (error instanceof AppleStoreError) {
    return error;
  }

  if (error instanceof VerificationException) {
    const reason =
      error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE
        ? "unavailable"
        : "invalidTransaction";

    return new AppleStoreError(reason, { cause: error });
  }

  return new AppleStoreError("unavailable", { cause: error });
}

async function verifyTransaction({
  signedTransaction,
  verifier,
}: {
  signedTransaction: string;
  verifier: SignedDataVerifier;
}) {
  try {
    return await verifier.verifyAndDecodeTransaction(signedTransaction);
  } catch (error) {
    throw toAppleStoreError(error);
  }
}

async function verifyRenewalInfo({
  signedRenewalInfo,
  verifier,
}: {
  signedRenewalInfo: string;
  verifier: SignedDataVerifier;
}) {
  try {
    return await verifier.verifyAndDecodeRenewalInfo(signedRenewalInfo);
  } catch (error) {
    throw toAppleStoreError(error);
  }
}

function findCurrentTransaction({
  originalTransactionId,
  transactions,
}: {
  originalTransactionId: string;
  transactions: LastTransactionsItem[];
}) {
  return transactions.find((item) => item.originalTransactionId === originalTransactionId) ?? null;
}

function getEventSignedDate({
  renewalInfo,
  transaction,
}: {
  renewalInfo: JWSRenewalInfoDecodedPayload;
  transaction: JWSTransactionDecodedPayload;
}) {
  const transactionSignedDate = getSignedDate(transaction.signedDate);
  const renewalSignedDate = getSignedDate(renewalInfo.signedDate);
  return transactionSignedDate > renewalSignedDate ? transactionSignedDate : renewalSignedDate;
}

function doesNotChangeSubscriptionEntitlement(
  notificationType: NotificationTypeV2 | string | undefined,
) {
  return (
    notificationType === NotificationTypeV2.CONSUMPTION_REQUEST ||
    notificationType === NotificationTypeV2.REFUND_DECLINED
  );
}

/** A refund can re-sign an older renewal, so live environments must resolve Apple's current subscription chain before changing access. */
async function getCurrentSubscription({
  environment,
  originalTransactionId,
  transactionId,
  verifier,
}: {
  environment: Environment;
  originalTransactionId: string;
  transactionId: string;
  verifier: SignedDataVerifier;
}) {
  const client = getAppStoreServerClient(environment);

  if (!client) {
    if (environment === Environment.XCODE) {
      return null;
    }

    throw new AppleStoreError("unavailable");
  }

  try {
    const response = await client.getAllSubscriptionStatuses(transactionId);
    const transactions = (response.data ?? []).flatMap((group) => group.lastTransactions ?? []);
    const current = findCurrentTransaction({ originalTransactionId, transactions });

    if (!current?.signedTransactionInfo || !current.signedRenewalInfo) {
      throw new AppleStoreError("unavailable");
    }

    const [transaction, renewalInfo] = await Promise.all([
      verifyTransaction({ signedTransaction: current.signedTransactionInfo, verifier }),
      verifyRenewalInfo({ signedRenewalInfo: current.signedRenewalInfo, verifier }),
    ]);

    if (transaction.originalTransactionId !== originalTransactionId) {
      throw new AppleStoreError("invalidTransaction");
    }

    return createVerifiedAppleSubscription({
      eventId: null,
      eventSignedDate: getEventSignedDate({ renewalInfo, transaction }),
      renewalInfo,
      status: current.status,
      transaction,
    });
  } catch (error) {
    throw toAppleStoreError(error);
  }
}

/** Verifies native JWS data, then asks Apple for the current chain so an older refund cannot revoke a newer renewal. */
export async function getAppleSubscriptionFromTransaction({
  signedTransaction,
}: {
  signedTransaction: string;
}) {
  try {
    const { environment, verifier } = getSignedDataVerifier({
      kind: "transaction",
      signedData: signedTransaction,
    });

    const transaction = await verifyTransaction({ signedTransaction, verifier });
    const originalTransactionId = transaction.originalTransactionId;
    const transactionId = transaction.transactionId;

    if (!originalTransactionId || !transactionId) {
      throw new AppleStoreError("invalidTransaction");
    }

    const currentSubscription = await getCurrentSubscription({
      environment,
      originalTransactionId,
      transactionId,
      verifier,
    });

    return (
      currentSubscription ??
      createVerifiedAppleSubscription({
        eventId: null,
        eventSignedDate: getSignedDate(transaction.signedDate),
        renewalInfo: null,
        status: undefined,
        transaction,
      })
    );
  } catch (error) {
    throw toAppleStoreError(error);
  }
}

/** Verifies a V2 notification and resolves its current chain before returning an entitlement-changing snapshot. */
export async function getAppleSubscriptionFromNotification({
  signedPayload,
}: {
  signedPayload: string;
}) {
  try {
    const { environment, verifier } = getSignedDataVerifier({
      kind: "notification",
      signedData: signedPayload,
    });

    const notification = await verifier.verifyAndDecodeNotification(signedPayload);

    if (
      notification.notificationType === NotificationTypeV2.TEST ||
      doesNotChangeSubscriptionEntitlement(notification.notificationType)
    ) {
      return null;
    }

    const signedTransaction = notification.data?.signedTransactionInfo;

    if (!signedTransaction) {
      return null;
    }

    const signedRenewalInfo = notification.data?.signedRenewalInfo;

    const [transaction, renewalInfo] = await Promise.all([
      verifyTransaction({ signedTransaction, verifier }),
      signedRenewalInfo
        ? verifyRenewalInfo({ signedRenewalInfo, verifier })
        : Promise.resolve(null),
    ]);

    if (!notification.notificationUUID) {
      throw new AppleStoreError("invalidTransaction");
    }

    const eventSignedDate = getSignedDate(notification.signedDate);

    const notificationSubscription = createVerifiedAppleSubscription({
      eventId: notification.notificationUUID,
      eventSignedDate,
      renewalInfo,
      status: notification.data?.status,
      transaction,
    });

    const currentSubscription = await getCurrentSubscription({
      environment,
      originalTransactionId: notificationSubscription.originalTransactionId,
      transactionId: notificationSubscription.transactionId,
      verifier,
    });

    return currentSubscription
      ? { ...currentSubscription, eventId: notification.notificationUUID, eventSignedDate }
      : notificationSubscription;
  } catch (error) {
    throw toAppleStoreError(error);
  }
}
