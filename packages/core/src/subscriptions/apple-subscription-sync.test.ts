import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserSubscriptionCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { getAppleSubscriptionProduct } from "./apple-products";
import {
  getAppleSubscriptionFromNotification,
  getAppleSubscriptionFromTransaction,
} from "./apple-store";
import { type VerifiedAppleSubscription } from "./apple-store-payload";
import { processAppleSubscriptionNotification } from "./process-apple-subscription-notification";
import { reconcileAppleSubscription } from "./reconcile-apple-subscription";
import {
  AppleSubscriptionError,
  syncCurrentUserAppleSubscription,
} from "./sync-apple-subscription";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

vi.mock("./apple-store", () => ({
  getAppleSubscriptionFromNotification: vi.fn(),
  getAppleSubscriptionFromTransaction: vi.fn(),
}));

const PURCHASE_DATE = new Date("2026-08-19T12:00:00.000Z");
const EXPIRATION_DATE = new Date(Date.now() + 86_400_000);
const SIGNED_DATE = new Date("2026-08-19T12:00:01.000Z");

function makeAppleSubscription({
  accountToken,
  overrides = {},
}: {
  accountToken: string | null;
  overrides?: Partial<VerifiedAppleSubscription>;
}): VerifiedAppleSubscription {
  return {
    accountToken,
    environment: "sandbox",
    eventId: null,
    eventSignedDate: SIGNED_DATE,
    expirationDate: EXPIRATION_DATE,
    isActive: true,
    isAutoRenewEnabled: true,
    originalTransactionId: randomUUID(),
    productId: "com.zoonk.plus.monthly",
    purchaseDate: PURCHASE_DATE,
    revocationDate: null,
    transactionId: randomUUID(),
    transactionSignedDate: SIGNED_DATE,
    ...overrides,
  };
}

async function authenticateUser() {
  const user = await userFixture();
  vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });
  return user;
}

describe(syncCurrentUserAppleSubscription, () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(null);
  });

  it("requires an authenticated account before verifying a transaction", async () => {
    await expect(
      syncCurrentUserAppleSubscription({ signedTransaction: "signed-transaction" }),
    ).rejects.toMatchObject({ reason: "unauthorized" });

    expect(getAppleSubscriptionFromTransaction).not.toHaveBeenCalled();
  });

  it("persists a verified monthly entitlement for the matching account", async () => {
    const user = await authenticateUser();
    const verifiedSubscription = makeAppleSubscription({ accountToken: user.id });
    vi.mocked(getAppleSubscriptionFromTransaction).mockResolvedValue(verifiedSubscription);

    const result = await syncCurrentUserAppleSubscription({
      signedTransaction: "signed-transaction",
    });

    expect(result).toMatchObject({
      isActive: true,
      subscription: {
        billingInterval: "month",
        cancelAt: null,
        cancelAtPeriodEnd: false,
        periodEnd: EXPIRATION_DATE,
        periodStart: PURCHASE_DATE,
        plan: "plus",
        provider: "apple",
        providerEnvironment: "sandbox",
        providerEventId: null,
        providerProductId: "com.zoonk.plus.monthly",
        providerSignedAt: SIGNED_DATE,
        providerSubscriptionId: verifiedSubscription.originalTransactionId,
        providerTransactionId: verifiedSubscription.transactionId,
        referenceId: user.id,
        status: "active",
        userId: user.id,
      },
    });

    expect(revalidateTag).toHaveBeenCalledExactlyOnceWith(getUserSubscriptionCacheTag(user.id), {
      expire: 0,
    });
  });

  it("rejects a transaction associated with another account", async () => {
    const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    vi.mocked(getAppleSubscriptionFromTransaction).mockResolvedValue(
      makeAppleSubscription({ accountToken: otherUser.id }),
    );

    await expect(
      syncCurrentUserAppleSubscription({ signedTransaction: "signed-transaction" }),
    ).rejects.toMatchObject({ reason: "accountMismatch" });

    await expect(
      prisma.subscription.count({ where: { provider: "apple", referenceId: user.id } }),
    ).resolves.toBe(0);
  });

  it("rejects a verified transaction for an unsupported product", async () => {
    const user = await authenticateUser();

    vi.mocked(getAppleSubscriptionFromTransaction).mockResolvedValue(
      makeAppleSubscription({
        accountToken: user.id,
        overrides: { productId: "com.zoonk.pro.monthly" },
      }),
    );

    await expect(
      syncCurrentUserAppleSubscription({ signedTransaction: "signed-transaction" }),
    ).rejects.toMatchObject({ reason: "invalidProduct" });
  });

  it("persists an inactive transaction so the native client can finish it durably", async () => {
    const user = await authenticateUser();
    const endedAt = new Date(Date.now() - 86_400_000);

    vi.mocked(getAppleSubscriptionFromTransaction).mockResolvedValue(
      makeAppleSubscription({
        accountToken: user.id,
        overrides: { expirationDate: endedAt, isActive: false },
      }),
    );

    await expect(
      syncCurrentUserAppleSubscription({ signedTransaction: "signed-transaction" }),
    ).resolves.toMatchObject({ isActive: false, subscription: { endedAt, status: "canceled" } });
  });

  it("updates the same original transaction idempotently and ignores older signed state", async () => {
    const user = await authenticateUser();
    const originalTransactionId = randomUUID();
    const newerSignedDate = new Date("2026-08-20T12:00:00.000Z");
    const newerExpirationDate = new Date(Date.now() + 172_800_000);

    vi.mocked(getAppleSubscriptionFromTransaction)
      .mockResolvedValueOnce(
        makeAppleSubscription({ accountToken: user.id, overrides: { originalTransactionId } }),
      )
      .mockResolvedValueOnce(
        makeAppleSubscription({
          accountToken: user.id,
          overrides: {
            eventSignedDate: newerSignedDate,
            expirationDate: newerExpirationDate,
            originalTransactionId,
            productId: "com.zoonk.plus.yearly",
            transactionId: "2000000123456791",
            transactionSignedDate: newerSignedDate,
          },
        }),
      )
      .mockResolvedValueOnce(
        makeAppleSubscription({
          accountToken: user.id,
          overrides: {
            expirationDate: new Date(Date.now() - 86_400_000),
            isActive: false,
            originalTransactionId,
          },
        }),
      );

    await syncCurrentUserAppleSubscription({ signedTransaction: "initial" });
    await syncCurrentUserAppleSubscription({ signedTransaction: "newer" });
    const staleResult = await syncCurrentUserAppleSubscription({ signedTransaction: "stale" });

    expect(staleResult).toMatchObject({
      isActive: true,
      subscription: {
        billingInterval: "year",
        periodEnd: newerExpirationDate,
        providerSignedAt: newerSignedDate,
        providerTransactionId: "2000000123456791",
      },
    });

    await expect(
      prisma.subscription.count({
        where: { provider: "apple", providerSubscriptionId: originalTransactionId },
      }),
    ).resolves.toBe(1);
  });

  it("does not let one original transaction move between existing accounts", async () => {
    const [firstUser, secondUser] = await Promise.all([userFixture(), userFixture()]);
    const originalTransactionId = randomUUID();
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user: firstUser });

    vi.mocked(getAppleSubscriptionFromTransaction).mockResolvedValue(
      makeAppleSubscription({ accountToken: firstUser.id, overrides: { originalTransactionId } }),
    );

    await syncCurrentUserAppleSubscription({ signedTransaction: "first-account" });

    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user: secondUser });

    vi.mocked(getAppleSubscriptionFromTransaction).mockResolvedValue(
      makeAppleSubscription({ accountToken: secondUser.id, overrides: { originalTransactionId } }),
    );

    await expect(
      syncCurrentUserAppleSubscription({ signedTransaction: "second-account" }),
    ).rejects.toMatchObject({ reason: "conflict" });
  });
});

describe(processAppleSubscriptionNotification, () => {
  it("creates an entitlement from a verified notification account token", async () => {
    const user = await userFixture();

    const verifiedSubscription = makeAppleSubscription({
      accountToken: user.id,
      overrides: { eventId: randomUUID() },
    });

    vi.mocked(getAppleSubscriptionFromNotification).mockResolvedValue(verifiedSubscription);

    const subscription = await processAppleSubscriptionNotification({
      signedPayload: "signed-notification",
    });

    expect(subscription).toMatchObject({
      provider: "apple",
      providerSubscriptionId: verifiedSubscription.originalTransactionId,
      referenceId: user.id,
      status: "active",
    });
  });

  it("acknowledges notifications for a deleted account without recreating it", async () => {
    const user = await userFixture();
    await prisma.user.delete({ where: { id: user.id } });

    vi.mocked(getAppleSubscriptionFromNotification).mockResolvedValue(
      makeAppleSubscription({ accountToken: user.id, overrides: { eventId: randomUUID() } }),
    );

    await expect(
      processAppleSubscriptionNotification({ signedPayload: "signed-notification" }),
    ).resolves.toBeNull();

    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.toBeNull();
  });

  it("rejects reconciliation when account deletion wins after reference resolution", async () => {
    const user = await userFixture();
    const verifiedSubscription = makeAppleSubscription({ accountToken: user.id });
    const product = getAppleSubscriptionProduct(verifiedSubscription.productId);

    if (!product) {
      throw new Error("Expected the test product to be supported");
    }

    await prisma.user.delete({ where: { id: user.id } });

    await expect(
      reconcileAppleSubscription({ product, referenceId: user.id, verifiedSubscription }),
    ).rejects.toMatchObject({ code: "P2003" });

    await expect(
      prisma.subscription.count({
        where: {
          provider: "apple",
          providerSubscriptionId: verifiedSubscription.originalTransactionId,
        },
      }),
    ).resolves.toBe(0);
  });

  it("removes a notification reconciliation that lands during account deletion", async () => {
    const user = await userFixture();
    const originalTransactionId = randomUUID();

    const verifiedSubscription = makeAppleSubscription({
      accountToken: user.id,
      overrides: { eventId: randomUUID(), originalTransactionId },
    });

    vi.mocked(getAppleSubscriptionFromNotification).mockResolvedValue(verifiedSubscription);

    await processAppleSubscriptionNotification({ signedPayload: "initial-notification" });
    await prisma.subscription.deleteMany({ where: { referenceId: user.id } });

    await expect(
      processAppleSubscriptionNotification({ signedPayload: "racing-notification" }),
    ).resolves.toMatchObject({ referenceId: user.id });

    await prisma.user.delete({ where: { id: user.id } });

    await expect(
      prisma.subscription.count({
        where: { provider: "apple", providerSubscriptionId: originalTransactionId },
      }),
    ).resolves.toBe(0);
  });

  it("keeps access active until period end after auto-renew is disabled", async () => {
    const user = await userFixture();

    vi.mocked(getAppleSubscriptionFromNotification).mockResolvedValue(
      makeAppleSubscription({
        accountToken: user.id,
        overrides: { eventId: randomUUID(), isAutoRenewEnabled: false },
      }),
    );

    const subscription = await processAppleSubscriptionNotification({
      signedPayload: "renewal-disabled",
    });

    expect(subscription).toMatchObject({
      cancelAt: EXPIRATION_DATE,
      cancelAtPeriodEnd: true,
      periodEnd: EXPIRATION_DATE,
      status: "active",
    });
  });

  it("ends an existing entitlement without moving its account association", async () => {
    const user = await userFixture();
    const originalTransactionId = randomUUID();

    vi.mocked(getAppleSubscriptionFromNotification).mockResolvedValue(
      makeAppleSubscription({
        accountToken: user.id,
        overrides: { eventId: randomUUID(), originalTransactionId },
      }),
    );

    await processAppleSubscriptionNotification({ signedPayload: "initial" });

    const endedAt = new Date("2026-09-19T12:00:00.000Z");

    vi.mocked(getAppleSubscriptionFromNotification).mockResolvedValue(
      makeAppleSubscription({
        accountToken: randomUUID(),
        overrides: {
          eventId: randomUUID(),
          eventSignedDate: new Date("2026-09-19T12:00:01.000Z"),
          expirationDate: endedAt,
          isActive: false,
          isAutoRenewEnabled: false,
          originalTransactionId,
          transactionSignedDate: new Date("2026-08-18T12:00:01.000Z"),
        },
      }),
    );

    const subscription = await processAppleSubscriptionNotification({
      signedPayload: "expiration",
    });

    expect(subscription).toMatchObject({ endedAt, referenceId: user.id, status: "canceled" });
  });

  it("does nothing for a verified notification without subscription state", async () => {
    vi.mocked(getAppleSubscriptionFromNotification).mockResolvedValue(null);

    await expect(
      processAppleSubscriptionNotification({ signedPayload: "test-notification" }),
    ).resolves.toBeNull();
  });
});

describe(AppleSubscriptionError, () => {
  it("preserves a stable reason for API error mapping", () => {
    expect(new AppleSubscriptionError("invalidTransaction")).toMatchObject({
      name: "AppleSubscriptionError",
      reason: "invalidTransaction",
    });
  });
});
