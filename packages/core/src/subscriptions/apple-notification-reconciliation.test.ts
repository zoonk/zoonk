import { randomUUID } from "node:crypto";
import { AutoRenewStatus, NotificationTypeV2, Status, Type } from "@apple/app-store-server-library";
import {
  sendPlusTwiceEmail,
  sendWebPlusEndedBesideStoreEmail,
} from "@zoonk/auth/duplicate-plus-emails";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { processAppleSubscriptionNotification } from "./process-apple-subscription-notification";

const stripe = vi.hoisted(() => ({
  cancel: vi.fn(),
  paymentIntent: vi.fn(),
  refund: vi.fn(),
  retrieve: vi.fn(),
}));

// Stripe and the mailer are external services; the learner's subscription rows are real.
vi.mock("@zoonk/auth/stripe-client", () => ({
  stripeClient: {
    paymentIntents: { retrieve: stripe.paymentIntent },
    refunds: { create: stripe.refund },
    subscriptions: { cancel: stripe.cancel, retrieve: stripe.retrieve },
  },
}));

vi.mock("@zoonk/auth/duplicate-plus-emails", () => ({
  sendPlusTwiceEmail: vi.fn(),
  sendWebPlusEndedBesideStoreEmail: vi.fn(),
}));

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function makeUnsignedXcodePayload(payload: unknown) {
  return `${encode({ alg: "none" })}.${encode(payload)}.`;
}

function makeTransaction({
  accountToken,
  expirationDate,
  originalTransactionId,
  productId,
  purchaseDate,
  revocationDate,
  signedDate,
}: {
  accountToken: string;
  expirationDate: Date;
  originalTransactionId: string;
  productId: string;
  purchaseDate: Date;
  revocationDate?: Date;
  signedDate: Date;
}) {
  return makeUnsignedXcodePayload({
    appAccountToken: accountToken,
    bundleId: "com.zoonk.dev",
    environment: "Xcode",
    expiresDate: expirationDate.getTime(),
    originalTransactionId,
    productId,
    purchaseDate: purchaseDate.getTime(),
    ...(revocationDate && { revocationDate: revocationDate.getTime() }),
    signedDate: signedDate.getTime(),
    transactionId: randomUUID(),
    type: Type.AUTO_RENEWABLE_SUBSCRIPTION,
  });
}

function makeRenewalInfo({
  accountToken,
  originalTransactionId,
  productId,
  renewalDate,
  signedDate,
}: {
  accountToken: string;
  originalTransactionId: string;
  productId: string;
  renewalDate: Date;
  signedDate: Date;
}) {
  return makeUnsignedXcodePayload({
    appAccountToken: accountToken,
    autoRenewStatus: AutoRenewStatus.ON,
    environment: "Xcode",
    originalTransactionId,
    productId,
    renewalDate: renewalDate.getTime(),
    signedDate: signedDate.getTime(),
  });
}

function makeNotification({
  notificationType,
  signedDate,
  signedRenewalInfo,
  signedTransactionInfo,
}: {
  notificationType: NotificationTypeV2;
  signedDate: Date;
  signedRenewalInfo: string;
  signedTransactionInfo: string;
}) {
  return makeUnsignedXcodePayload({
    data: {
      bundleId: "com.zoonk.dev",
      environment: "Xcode",
      signedRenewalInfo,
      signedTransactionInfo,
      status: Status.ACTIVE,
    },
    notificationType,
    notificationUUID: randomUUID(),
    signedDate: signedDate.getTime(),
    version: "2.0",
  });
}

describe(processAppleSubscriptionNotification, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("preserves the current entitlement and period end when a refund references an older renewal", async () => {
    vi.stubEnv("APPLE_IAP_ALLOW_XCODE_TRANSACTIONS", "true");
    vi.stubEnv("APPLE_IAP_ISSUER_ID", "");
    vi.stubEnv("APPLE_IAP_KEY_ID", "");
    vi.stubEnv("APPLE_IAP_PRIVATE_KEY", "");

    const user = await userFixture();
    const originalTransactionId = randomUUID();
    const currentPurchaseDate = new Date(Date.now() - 86_400_000);
    const currentExpirationDate = new Date(Date.now() + 365 * 86_400_000);
    const initialSignedDate = new Date();

    const currentRenewalInfo = makeRenewalInfo({
      accountToken: user.id,
      originalTransactionId,
      productId: "com.zoonk.plus.yearly",
      renewalDate: currentExpirationDate,
      signedDate: initialSignedDate,
    });

    const initialSubscription = await processAppleSubscriptionNotification({
      signedPayload: makeNotification({
        notificationType: NotificationTypeV2.DID_RENEW,
        signedDate: initialSignedDate,
        signedRenewalInfo: currentRenewalInfo,
        signedTransactionInfo: makeTransaction({
          accountToken: user.id,
          expirationDate: currentExpirationDate,
          originalTransactionId,
          productId: "com.zoonk.plus.yearly",
          purchaseDate: currentPurchaseDate,
          signedDate: initialSignedDate,
        }),
      }),
    });

    expect(initialSubscription).toMatchObject({
      billingInterval: "year",
      periodEnd: currentExpirationDate,
      status: "active",
    });

    const refundSignedDate = new Date(initialSignedDate.getTime() + 1000);

    const subscriptionAfterRefund = await processAppleSubscriptionNotification({
      signedPayload: makeNotification({
        notificationType: NotificationTypeV2.REFUND,
        signedDate: refundSignedDate,
        signedRenewalInfo: makeRenewalInfo({
          accountToken: user.id,
          originalTransactionId,
          productId: "com.zoonk.plus.yearly",
          renewalDate: currentExpirationDate,
          signedDate: refundSignedDate,
        }),
        signedTransactionInfo: makeTransaction({
          accountToken: user.id,
          expirationDate: new Date(currentPurchaseDate.getTime() - 1),
          originalTransactionId,
          productId: "com.zoonk.plus.monthly",
          purchaseDate: new Date(currentPurchaseDate.getTime() - 31 * 86_400_000),
          revocationDate: refundSignedDate,
          signedDate: refundSignedDate,
        }),
      }),
    });

    expect(subscriptionAfterRefund).toMatchObject({
      billingInterval: "year",
      endedAt: null,
      periodEnd: currentExpirationDate,
      providerProductId: "com.zoonk.plus.yearly",
      status: "active",
    });
  });
});

/** Plus bought on the website: Stripe bills it until it's canceled, refunded once. */
async function addWebPlus(userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const state = { refunded: 0, status: "active" };
  const id = `sub_${randomUUID()}`;

  const read = () => ({
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    ended_at: null,
    id,
    items: {
      data: [
        {
          current_period_end: now + 30 * 86_400,
          current_period_start: now,
          id: "si_plus",
          price: { recurring: { interval: "month" } },
        },
      ],
    },
    latest_invoice: {
      amount_paid: 999,
      currency: "eur",
      id: "in_plus",
      payments: { data: [{ payment: { payment_intent: "pi_plus" }, status: "paid" }] },
      status: "paid",
    },
    metadata: { locale: "pt" },
    status: state.status,
  });

  stripe.retrieve.mockImplementation(async () => read());

  stripe.paymentIntent.mockImplementation(async () => ({
    latest_charge: { amount_refunded: state.refunded },
  }));

  stripe.refund.mockImplementation(async ({ amount }: { amount: number }) => {
    state.refunded += amount;
    return { id: "re_plus", status: "succeeded" };
  });

  stripe.cancel.mockImplementation(async () => {
    state.status = "canceled";
    return read();
  });

  return prisma.subscription.create({
    data: { plan: "plus", referenceId: userId, status: "active", stripeSubscriptionId: id },
  });
}

/** The App Store's notification of a new monthly subscription, which Apple has already charged. */
function appStoreSubscribed({
  originalTransactionId,
  signedDate,
  userId,
}: {
  originalTransactionId: string;
  signedDate: Date;
  userId: string;
}) {
  const expirationDate = new Date(signedDate.getTime() + 30 * 86_400_000);
  const product = { originalTransactionId, productId: "com.zoonk.plus.monthly", signedDate };

  return makeNotification({
    notificationType: NotificationTypeV2.SUBSCRIBED,
    signedDate,
    signedRenewalInfo: makeRenewalInfo({
      ...product,
      accountToken: userId,
      renewalDate: expirationDate,
    }),
    signedTransactionInfo: makeTransaction({
      ...product,
      accountToken: userId,
      expirationDate,
      purchaseDate: signedDate,
    }),
  });
}

describe("an App Store purchase beside other Plus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APPLE_IAP_ALLOW_XCODE_TRANSACTIONS", "true");
    vi.stubEnv("APPLE_IAP_ISSUER_ID", "");
    vi.stubEnv("APPLE_IAP_KEY_ID", "");
    vi.stubEnv("APPLE_IAP_PRIVATE_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ends website Plus with a full refund, once across Apple's retries", async () => {
    const user = await userFixture();
    const webPlus = await addWebPlus(user.id);

    const signedPayload = appStoreSubscribed({
      originalTransactionId: randomUUID(),
      signedDate: new Date(),
      userId: user.id,
    });

    await processAppleSubscriptionNotification({ signedPayload });
    await processAppleSubscriptionNotification({ signedPayload });

    expect(stripe.refund).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ amount: 999, payment_intent: "pi_plus" }),
      expect.anything(),
    );

    expect(stripe.cancel).toHaveBeenCalledExactlyOnceWith(webPlus.stripeSubscriptionId, {
      cancellation_details: { comment: "Plus through the App Store too" },
      prorate: false,
    });

    expect(sendWebPlusEndedBesideStoreEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        email: user.email,
        locale: "pt",
        refund: { amount: 999, currency: "eur" },
        store: "apple",
      }),
    );

    await expect(
      prisma.subscription.findUniqueOrThrow({ where: { id: webPlus.id } }),
    ).resolves.toMatchObject({ status: "canceled" });
  });

  it("asks the learner to cancel a second store's Plus, once", async () => {
    const user = await userFixture();
    const originalTransactionId = randomUUID();
    const signedDate = new Date();

    await prisma.subscription.create({
      data: {
        periodEnd: new Date(Date.now() + 30 * 86_400_000),
        plan: "plus",
        provider: "google",
        providerSubscriptionId: randomUUID(),
        referenceId: user.id,
        status: "active",
        userId: user.id,
      },
    });

    const subscribed = appStoreSubscribed({ originalTransactionId, signedDate, userId: user.id });
    await processAppleSubscriptionNotification({ signedPayload: subscribed });
    await processAppleSubscriptionNotification({ signedPayload: subscribed });

    // A later notification of the same chain while both still give Plus.
    await processAppleSubscriptionNotification({
      signedPayload: appStoreSubscribed({
        originalTransactionId,
        signedDate: new Date(signedDate.getTime() + 1000),
        userId: user.id,
      }),
    });

    expect(sendPlusTwiceEmail).toHaveBeenCalledExactlyOnceWith({
      email: user.email,
      store: "apple",
    });

    expect(stripe.cancel).not.toHaveBeenCalled();
  });
});
