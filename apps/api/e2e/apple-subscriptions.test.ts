import { randomUUID } from "node:crypto";
import { type APIResponse, request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { createAuthenticatedApiContext } from "./helpers/auth";

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function makeUnsignedXcodePayload(payload: unknown) {
  return `${encode({ alg: "none" })}.${encode(payload)}.`;
}

function makeAppleTransaction({
  accountToken,
  isActive = true,
}: {
  accountToken: string;
  isActive?: boolean;
}) {
  const now = Date.now();

  const transaction = {
    appAccountToken: accountToken,
    bundleId: "com.zoonk.dev",
    environment: "Xcode",
    expiresDate: now + (isActive ? 86_400_000 : -86_400_000),
    originalTransactionId: randomUUID(),
    productId: "com.zoonk.plus.monthly",
    purchaseDate: now + (isActive ? 0 : -172_800_000),
    signedDate: now,
    transactionId: randomUUID(),
    type: "Auto-Renewable Subscription",
  };

  return { signedTransaction: makeUnsignedXcodePayload(transaction), transaction };
}

async function expectApiError({
  code,
  response,
  status,
}: {
  code: string;
  response: APIResponse;
  status: number;
}) {
  expect(response.status()).toBe(status);
  await expect(response.json()).resolves.toMatchObject({ error: { code } });
}

test.describe("Apple subscription API", () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("persists an authenticated App Store purchase and exposes it through /me", async ({
    baseURL,
  }) => {
    const apiBaseURL = baseURL ?? "";

    const authenticated = await createAuthenticatedApiContext({
      baseURL: apiBaseURL,
      prefix: "apple-subscription",
    });

    const { signedTransaction, transaction } = makeAppleTransaction({
      accountToken: authenticated.user.id,
    });

    const response = await authenticated.apiContext.post("/v1/me/subscriptions/apple", {
      data: { signedTransaction },
    });

    expect(response.status()).toBe(200);

    await expect(response.json()).resolves.toMatchObject({
      currentAccount: {
        account: {
          hasActiveSubscription: true,
          subscription: { plan: "plus", provider: "apple", status: "active" },
        },
        user: { id: authenticated.user.id },
      },
      isActive: true,
    });

    await expect(
      prisma.subscription.findUnique({
        where: {
          provider_providerSubscriptionId: {
            provider: "apple",
            providerSubscriptionId: transaction.originalTransactionId,
          },
        },
      }),
    ).resolves.toMatchObject({
      billingInterval: "month",
      providerEnvironment: "xcode",
      providerProductId: "com.zoonk.plus.monthly",
      providerTransactionId: transaction.transactionId,
      referenceId: authenticated.user.id,
      status: "active",
    });

    const webContext = await request.newContext({
      baseURL: apiBaseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${authenticated.token}` },
    });

    const webResponse = await webContext.get("/v1/me");

    await expect(webResponse.json()).resolves.toMatchObject({
      account: { hasActiveSubscription: true, subscription: { provider: "apple" } },
    });

    await Promise.all([authenticated.apiContext.dispose(), webContext.dispose()]);
  });

  test("rejects an App Store purchase linked to a different account", async ({ baseURL }) => {
    const apiBaseURL = baseURL ?? "";

    const authenticated = await createAuthenticatedApiContext({
      baseURL: apiBaseURL,
      prefix: "apple-mismatch",
    });

    const { signedTransaction, transaction } = makeAppleTransaction({ accountToken: randomUUID() });

    const response = await authenticated.apiContext.post("/v1/me/subscriptions/apple", {
      data: { signedTransaction },
    });

    await expectApiError({ code: "APPLE_ACCOUNT_MISMATCH", response, status: 409 });

    await expect(
      prisma.subscription.findFirst({
        where: { provider: "apple", providerSubscriptionId: transaction.originalTransactionId },
      }),
    ).resolves.toBeNull();

    await authenticated.apiContext.dispose();
  });

  test("records an expired App Store transaction without reporting active access", async ({
    baseURL,
  }) => {
    const authenticated = await createAuthenticatedApiContext({
      baseURL: baseURL ?? "",
      prefix: "apple-expired",
    });

    const { signedTransaction, transaction } = makeAppleTransaction({
      accountToken: authenticated.user.id,
      isActive: false,
    });

    const response = await authenticated.apiContext.post("/v1/me/subscriptions/apple", {
      data: { signedTransaction },
    });

    expect(response.status()).toBe(200);

    await expect(response.json()).resolves.toMatchObject({
      currentAccount: {
        account: { hasActiveSubscription: false, subscription: null },
        user: { id: authenticated.user.id },
      },
      isActive: false,
    });

    await expect(
      prisma.subscription.findUnique({
        where: {
          provider_providerSubscriptionId: {
            provider: "apple",
            providerSubscriptionId: transaction.originalTransactionId,
          },
        },
      }),
    ).resolves.toMatchObject({ endedAt: expect.any(Date), status: "canceled" });

    await authenticated.apiContext.dispose();
  });

  test("rejects unauthenticated purchase reconciliation before verification", async ({
    baseURL,
  }) => {
    const apiContext = await request.newContext({ baseURL: baseURL ?? "" });

    const response = await apiContext.post("/v1/me/subscriptions/apple", {
      data: { signedTransaction: "not-a-jws" },
    });

    await expectApiError({ code: "UNAUTHORIZED", response, status: 401 });
    await apiContext.dispose();
  });

  test("rejects invalid notifications and acknowledges verified test notifications", async ({
    baseURL,
  }) => {
    const apiContext = await request.newContext({ baseURL: baseURL ?? "" });

    const invalidResponse = await apiContext.post("/v1/subscriptions/apple/notifications", {
      data: { signedPayload: "not-a-jws" },
    });

    await expectApiError({
      code: "APPLE_NOTIFICATION_INVALID",
      response: invalidResponse,
      status: 400,
    });

    const signedPayload = makeUnsignedXcodePayload({
      data: { bundleId: "com.zoonk.dev", environment: "Xcode" },
      notificationType: "TEST",
      notificationUUID: randomUUID(),
      signedDate: Date.now(),
      version: "2.0",
    });

    const acknowledgedResponse = await apiContext.post("/v1/subscriptions/apple/notifications", {
      data: { signedPayload },
    });

    expect(acknowledgedResponse.status()).toBe(204);
    await apiContext.dispose();
  });
});
