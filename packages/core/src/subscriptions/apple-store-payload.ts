import {
  AutoRenewStatus,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  Status,
  Type,
} from "@apple/app-store-server-library";
import { z } from "zod";
import { type AppleSubscriptionEnvironment, normalizeAppleEnvironment } from "./apple-store-config";
import { AppleStoreError } from "./apple-store-error";

export type VerifiedAppleSubscription = {
  accountToken: string | null;
  environment: AppleSubscriptionEnvironment;
  eventId: string | null;
  eventSignedDate: Date;
  expirationDate: Date;
  isActive: boolean;
  isAutoRenewEnabled: boolean;
  originalTransactionId: string;
  productId: string;
  purchaseDate: Date;
  revocationDate: Date | null;
  transactionId: string;
  transactionSignedDate: Date;
};

const accountTokenSchema = z.uuid();
const activeSubscriptionStatuses = new Set<number>([Status.ACTIVE, Status.BILLING_GRACE_PERIOD]);

function getRequiredString(value: string | undefined) {
  if (!value) {
    throw new AppleStoreError("invalidTransaction");
  }

  return value;
}

function getRequiredDate(value: number | undefined) {
  const date = value === undefined ? null : new Date(value);

  if (!date || Number.isNaN(date.getTime())) {
    throw new AppleStoreError("invalidTransaction");
  }

  return date;
}

function getOptionalDate(value: number | undefined) {
  if (value === undefined) {
    return null;
  }

  return getRequiredDate(value);
}

/**
 * Reads Apple's signed Zoonk account binding from either payload and rejects a transaction
 * whose renewal information names a different account.
 */
function getAccountToken({
  renewalInfo,
  transaction,
}: {
  renewalInfo: JWSRenewalInfoDecodedPayload | null;
  transaction: JWSTransactionDecodedPayload;
}) {
  const transactionAccountToken = transaction.appAccountToken?.toLowerCase();
  const renewalAccountToken = renewalInfo?.appAccountToken?.toLowerCase();
  const accountToken = transactionAccountToken ?? renewalAccountToken;

  if (
    transactionAccountToken &&
    renewalAccountToken &&
    transactionAccountToken !== renewalAccountToken
  ) {
    throw new AppleStoreError("invalidTransaction");
  }

  if (!accountToken) {
    return null;
  }

  const result = accountTokenSchema.safeParse(accountToken);

  if (!result.success) {
    throw new AppleStoreError("invalidTransaction");
  }

  return result.data.toLowerCase();
}

function getExpirationDate({
  renewalInfo,
  status,
  transaction,
}: {
  renewalInfo: JWSRenewalInfoDecodedPayload | null;
  status: Status | number | undefined;
  transaction: JWSTransactionDecodedPayload;
}) {
  const transactionExpirationDate = getRequiredDate(transaction.expiresDate);
  const renewalDate = getOptionalDate(renewalInfo?.renewalDate);
  const expirationDate = renewalDate ?? transactionExpirationDate;
  const gracePeriodEnd = getOptionalDate(renewalInfo?.gracePeriodExpiresDate);

  if (status === Status.BILLING_GRACE_PERIOD && gracePeriodEnd && gracePeriodEnd > expirationDate) {
    return gracePeriodEnd;
  }

  return expirationDate;
}

function getIsActive({
  expirationDate,
  revocationDate,
  status,
}: {
  expirationDate: Date;
  revocationDate: Date | null;
  status: Status | number | undefined;
}) {
  if (status !== undefined) {
    if (activeSubscriptionStatuses.has(status)) {
      return expirationDate > new Date();
    }

    return false;
  }

  return (!revocationDate || revocationDate > new Date()) && expirationDate > new Date();
}

/**
 * Notification status describes the current subscription chain, while the
 * attached transaction can be an older renewal involved in a refund event.
 */
function getRevocationDate({
  eventSignedDate,
  status,
  transaction,
}: {
  eventSignedDate: Date;
  status: Status | number | undefined;
  transaction: JWSTransactionDecodedPayload;
}) {
  const transactionRevocationDate = getOptionalDate(transaction.revocationDate);

  if (status === Status.REVOKED) {
    return transactionRevocationDate ?? eventSignedDate;
  }

  return status === undefined ? transactionRevocationDate : null;
}

function getProductId({
  renewalInfo,
  transaction,
}: {
  renewalInfo: JWSRenewalInfoDecodedPayload | null;
  transaction: JWSTransactionDecodedPayload;
}) {
  return getRequiredString(renewalInfo?.productId ?? transaction.productId);
}

function assertMatchingRenewalInfo({
  renewalInfo,
  transaction,
}: {
  renewalInfo: JWSRenewalInfoDecodedPayload | null;
  transaction: JWSTransactionDecodedPayload;
}) {
  if (
    renewalInfo?.originalTransactionId &&
    renewalInfo.originalTransactionId !== transaction.originalTransactionId
  ) {
    throw new AppleStoreError("invalidTransaction");
  }
}

/**
 * Converts Apple's verified transaction and renewal payloads into the one entitlement shape
 * persisted by native purchase synchronization and server notifications.
 */
export function createVerifiedAppleSubscription({
  eventId,
  eventSignedDate,
  renewalInfo,
  status,
  transaction,
}: {
  eventId: string | null;
  eventSignedDate: Date;
  renewalInfo: JWSRenewalInfoDecodedPayload | null;
  status: Status | number | undefined;
  transaction: JWSTransactionDecodedPayload;
}): VerifiedAppleSubscription {
  if (transaction.type !== Type.AUTO_RENEWABLE_SUBSCRIPTION) {
    throw new AppleStoreError("invalidTransaction");
  }

  assertMatchingRenewalInfo({ renewalInfo, transaction });
  const expirationDate = getExpirationDate({ renewalInfo, status, transaction });
  const revocationDate = getRevocationDate({ eventSignedDate, status, transaction });

  return {
    accountToken: getAccountToken({ renewalInfo, transaction }),
    environment: normalizeAppleEnvironment(transaction.environment),
    eventId,
    eventSignedDate,
    expirationDate,
    isActive: getIsActive({ expirationDate, revocationDate, status }),
    isAutoRenewEnabled: renewalInfo ? renewalInfo.autoRenewStatus === AutoRenewStatus.ON : true,
    originalTransactionId: getRequiredString(transaction.originalTransactionId),
    productId: getProductId({ renewalInfo, transaction }),
    purchaseDate: getRequiredDate(transaction.purchaseDate),
    revocationDate,
    transactionId: getRequiredString(transaction.transactionId),
    transactionSignedDate: getRequiredDate(transaction.signedDate),
  };
}

export function getSignedDate(value: number | undefined) {
  return getRequiredDate(value);
}
