import {
  AutoRenewStatus,
  Environment,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  Status,
  Type,
} from "@apple/app-store-server-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVerifiedAppleSubscription } from "./apple-store-payload";

const NOW = new Date("2026-08-19T12:00:00.000Z");
const EVENT_SIGNED_DATE = new Date("2026-08-19T12:00:01.000Z");
const TRANSACTION_EXPIRATION_DATE = new Date("2026-08-19T11:00:00.000Z");
const GRACE_PERIOD_EXPIRATION_DATE = new Date("2026-08-20T12:00:00.000Z");

function makeTransaction(
  overrides: Partial<JWSTransactionDecodedPayload> = {},
): JWSTransactionDecodedPayload {
  return {
    appAccountToken: "91608ed4-60a4-47cb-8a69-9396f47f29a2",
    bundleId: "com.zoonk",
    environment: Environment.SANDBOX,
    expiresDate: TRANSACTION_EXPIRATION_DATE.getTime(),
    originalTransactionId: "2000000123456789",
    productId: "com.zoonk.plus.monthly",
    purchaseDate: new Date("2026-07-19T12:00:00.000Z").getTime(),
    signedDate: EVENT_SIGNED_DATE.getTime(),
    transactionId: "2000000123456790",
    type: Type.AUTO_RENEWABLE_SUBSCRIPTION,
    ...overrides,
  };
}

function makeRenewalInfo(
  overrides: Partial<JWSRenewalInfoDecodedPayload> = {},
): JWSRenewalInfoDecodedPayload {
  return {
    appAccountToken: "91608ed4-60a4-47cb-8a69-9396f47f29a2",
    autoRenewStatus: AutoRenewStatus.ON,
    environment: Environment.SANDBOX,
    originalTransactionId: "2000000123456789",
    signedDate: EVENT_SIGNED_DATE.getTime(),
    ...overrides,
  };
}

describe(createVerifiedAppleSubscription, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps billing-grace access active through Apple's grace period expiration", () => {
    const subscription = createVerifiedAppleSubscription({
      eventId: "0198c722-e072-7221-a24b-756dd0952911",
      eventSignedDate: EVENT_SIGNED_DATE,
      renewalInfo: makeRenewalInfo({
        gracePeriodExpiresDate: GRACE_PERIOD_EXPIRATION_DATE.getTime(),
      }),
      status: Status.BILLING_GRACE_PERIOD,
      transaction: makeTransaction(),
    });

    expect(subscription).toMatchObject({
      expirationDate: GRACE_PERIOD_EXPIRATION_DATE,
      isActive: true,
    });
  });

  it("ends revoked access at the verified event time when Apple omits a revocation date", () => {
    const subscription = createVerifiedAppleSubscription({
      eventId: "0198c722-e072-7221-a24b-756dd0952911",
      eventSignedDate: EVENT_SIGNED_DATE,
      renewalInfo: makeRenewalInfo(),
      status: Status.REVOKED,
      transaction: makeTransaction({ expiresDate: GRACE_PERIOD_EXPIRATION_DATE.getTime() }),
    });

    expect(subscription).toMatchObject({ isActive: false, revocationDate: EVENT_SIGNED_DATE });
  });

  it("uses current renewal state when an active notification carries an older revoked transaction", () => {
    const currentRenewalDate = new Date("2026-09-19T12:00:00.000Z");

    const subscription = createVerifiedAppleSubscription({
      eventId: "0198c722-e072-7221-a24b-756dd0952911",
      eventSignedDate: EVENT_SIGNED_DATE,
      renewalInfo: makeRenewalInfo({
        productId: "com.zoonk.plus.yearly",
        renewalDate: currentRenewalDate.getTime(),
      }),
      status: Status.ACTIVE,
      transaction: makeTransaction({
        expiresDate: TRANSACTION_EXPIRATION_DATE.getTime(),
        revocationDate: EVENT_SIGNED_DATE.getTime(),
      }),
    });

    expect(subscription).toMatchObject({
      expirationDate: currentRenewalDate,
      isActive: true,
      productId: "com.zoonk.plus.yearly",
      revocationDate: null,
    });
  });
});
