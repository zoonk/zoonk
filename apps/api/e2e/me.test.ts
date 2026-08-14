import { randomUUID } from "node:crypto";
import { type APIResponse, request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { courseFixture, courseUserFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getString } from "@zoonk/utils/json";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { getOTPForEmail } from "./helpers/db";

const PASSWORD = "password123";

/**
 * Links an Apple identity to the test user so the public account response can
 * prove that Apple provider state comes from durable account data.
 */
function appleAccountFixture({ userId }: { userId: string }) {
  return prisma.account.create({
    data: { accountId: `e2e-apple-${randomUUID()}`, id: randomUUID(), providerId: "apple", userId },
  });
}

/**
 * Verifies the public API error envelope so tests assert the client contract
 * instead of coupling to framework-specific response details.
 */
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

  const body = await response.json();

  expect(body.error.code).toBe(code);
}

/**
 * Signs in through the public auth endpoint only to mint the session token, then
 * returns a bearer-authenticated context so `/v1/me` is tested like native apps
 * will call it instead of relying on browser cookies.
 */
async function createBearerApiContext({
  baseURL,
  uniqueId,
  withSubscription = false,
}: {
  baseURL: string;
  uniqueId: string;
  withSubscription?: boolean;
}) {
  const email = `e2e-me-${uniqueId}@zoonk.test`;
  const name = `E2E Me User ${uniqueId}`;
  const username = `e2e_me_${uniqueId}`;
  const signupContext = await request.newContext({ baseURL });

  const signupResponse = await signupContext.post("/v1/auth/sign-up/email", {
    data: { email, name, password: PASSWORD, username },
  });

  expect(signupResponse.ok()).toBe(true);
  await signupContext.dispose();

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  if (withSubscription) {
    await prisma.subscription.create({
      data: {
        id: randomUUID(),
        plan: "plus",
        provider: "zoonk",
        referenceId: user.id,
        status: "active",
      },
    });
  }

  const signInContext = await request.newContext({ baseURL });

  const signInResponse = await signInContext.post("/v1/auth/sign-in/email", {
    data: { email, password: PASSWORD },
  });

  expect(signInResponse.ok()).toBe(true);

  const signInBody = await signInResponse.json();
  await signInContext.dispose();

  const token = getString(signInBody, "token");

  if (!token) {
    throw new Error("Sign-in response did not include a session token.");
  }

  const apiContext = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });

  return { apiContext, email, name, token, userId: user.id, username };
}

test.describe("Current User API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("rejects unauthenticated requests", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get("/v1/me");

    await expectApiError({ code: "UNAUTHORIZED", response, status: 401 });

    await apiContext.dispose();
  });

  test("rejects unauthenticated profile updates", async () => {
    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.patch("/v1/me", { data: { name: "Unauthenticated User" } });

    await expectApiError({ code: "UNAUTHORIZED", response, status: 401 });

    await apiContext.dispose();
  });

  test("rejects unauthenticated account deletion", async () => {
    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.delete("/v1/me", { data: {} });

    await expectApiError({ code: "UNAUTHORIZED", response, status: 401 });

    await apiContext.dispose();
  });

  test("requires a fresh session to delete an account", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { apiContext, token, userId } = await createBearerApiContext({ baseURL, uniqueId });

    await prisma.session.update({
      data: { createdAt: new Date(Date.now() - 2 * 86_400_000) },
      where: { token },
    });

    const response = await apiContext.delete("/v1/me", { data: {} });

    await expectApiError({ code: "FORBIDDEN", response, status: 403 });
    await expect(prisma.user.findUnique({ where: { id: userId } })).resolves.not.toBeNull();

    await apiContext.dispose();
  });

  test("deletes a stale-session account and its personalized course after email OTP reauthentication", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const { apiContext, email, token, userId } = await createBearerApiContext({
      baseURL,
      uniqueId,
    });

    const personalizedCourse = await courseFixture({
      format: "personalized",
      title: `Email deletion course ${uniqueId}`,
      userId,
    });

    await Promise.all([
      prisma.session.update({
        data: { createdAt: new Date(Date.now() - 2 * 86_400_000) },
        where: { token },
      }),
      prisma.user.update({ data: { emailVerified: true }, where: { id: userId } }),
    ]);

    const otpContext = await request.newContext({ baseURL });

    const otpResponse = await otpContext.post("/v1/auth/email-otp/send-verification-otp", {
      data: { email, type: "sign-in" },
    });

    expect(otpResponse.ok()).toBe(true);

    const otp = await getOTPForEmail(email);

    if (!otp) {
      throw new Error("Account deletion OTP was not stored");
    }

    const response = await apiContext.delete("/v1/me", {
      data: { emailCredentials: { email, otp } },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ appleAuthorizationRevoked: null });

    const [user, course, sessionCount] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.course.findUnique({ where: { id: personalizedCourse.id } }),
      prisma.session.count({ where: { userId } }),
    ]);

    expect(user).toBeNull();
    expect(course).toBeNull();
    expect(sessionCount).toBe(0);

    await Promise.all([apiContext.dispose(), otpContext.dispose()]);
  });

  test("deletes the account, learning data, auth state, and local subscriptions", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const { apiContext, email, token, userId } = await createBearerApiContext({
      baseURL,
      uniqueId,
      withSubscription: true,
    });

    const [otherUser, organization] = await Promise.all([
      userFixture(),
      organizationFixture({ kind: "brand" }),
    ]);

    const [personalizedCourse, sharedCourse] = await Promise.all([
      courseFixture({
        format: "personalized",
        title: `Personalized account deletion course ${uniqueId}`,
        userId,
      }),
      courseFixture({
        isPublished: true,
        organizationId: organization.id,
        title: `Shared account deletion course ${uniqueId}`,
      }),
    ]);

    await Promise.all([
      courseUserFixture({ courseId: sharedCourse.id, userId }),
      courseUserFixture({ courseId: sharedCourse.id, userId: otherUser.id }),
    ]);

    await appleAccountFixture({ userId });

    const otpContext = await request.newContext({ baseURL });
    const otpIdentifier = `sign-in-otp-${email}`;

    const otpResponse = await otpContext.post("/v1/auth/email-otp/send-verification-otp", {
      data: { email, type: "sign-in" },
    });

    expect(otpResponse.ok()).toBe(true);

    await expect(prisma.verification.count({ where: { identifier: otpIdentifier } })).resolves.toBe(
      1,
    );

    const response = await apiContext.delete("/v1/me", { data: {} });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ appleAuthorizationRevoked: false });

    const [
      user,
      accountCount,
      sessionCount,
      progressCount,
      subscriptionCount,
      verificationCount,
      deletedCourse,
      preservedSharedCourse,
      deletedSharedMembership,
      preservedSharedMembership,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.account.count({ where: { userId } }),
      prisma.session.count({ where: { token, userId } }),
      prisma.userProgress.count({ where: { userId } }),
      prisma.subscription.count({ where: { referenceId: userId } }),
      prisma.verification.count({ where: { identifier: otpIdentifier } }),
      prisma.course.findUnique({ where: { id: personalizedCourse.id } }),
      prisma.course.findUnique({ where: { id: sharedCourse.id } }),
      prisma.courseUser.findUnique({
        where: { courseUser: { courseId: sharedCourse.id, userId } },
      }),
      prisma.courseUser.findUnique({
        where: { courseUser: { courseId: sharedCourse.id, userId: otherUser.id } },
      }),
    ]);

    expect(user).toBeNull();
    expect(accountCount).toBe(0);
    expect(sessionCount).toBe(0);
    expect(progressCount).toBe(0);
    expect(subscriptionCount).toBe(0);
    expect(verificationCount).toBe(0);
    expect(deletedCourse).toBeNull();
    expect(preservedSharedCourse?.userCount).toBe(1);
    expect(deletedSharedMembership).toBeNull();
    expect(preservedSharedMembership).not.toBeNull();

    const accountResponse = await apiContext.get("/v1/me");

    await expectApiError({ code: "UNAUTHORIZED", response: accountResponse, status: 401 });

    await Promise.all([apiContext.dispose(), otpContext.dispose()]);
  });

  test("returns the signed-in user and account state", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const { apiContext, email, name, userId, username } = await createBearerApiContext({
      baseURL,
      uniqueId,
      withSubscription: true,
    });

    const response = await apiContext.get("/v1/me");

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.user).toMatchObject({ email, id: userId, name, username });
    expect(body.user.emailVerified).toBe(false);
    expect(body.account.deletion.hasAppleAccount).toBe(false);
    expect(body.account.hasActiveSubscription).toBe(true);

    expect(body.account.subscription).toMatchObject({
      plan: "plus",
      provider: "zoonk",
      status: "active",
    });

    await apiContext.dispose();
  });

  test("returns Apple account state after profile reads and updates", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { apiContext, userId } = await createBearerApiContext({ baseURL, uniqueId });

    await appleAccountFixture({ userId });

    const getResponse = await apiContext.get("/v1/me");

    const updateResponse = await apiContext.patch("/v1/me", {
      data: { name: `Apple Me User ${uniqueId}` },
    });

    expect(getResponse.status()).toBe(200);
    expect(updateResponse.status()).toBe(200);

    const [getBody, updateBody] = await Promise.all([getResponse.json(), updateResponse.json()]);

    expect(getBody.account.deletion.hasAppleAccount).toBe(true);
    expect(updateBody.account.deletion.hasAppleAccount).toBe(true);

    await apiContext.dispose();
  });

  test("returns analytics preference and scheduled subscription cancellation state", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const cancelAt = new Date("2027-01-15T12:00:00.000Z");

    const { apiContext, userId } = await createBearerApiContext({
      baseURL,
      uniqueId,
      withSubscription: true,
    });

    await Promise.all([
      prisma.user.update({ data: { analyticsDisabled: true }, where: { id: userId } }),
      prisma.subscription.updateMany({
        data: { cancelAt, cancelAtPeriodEnd: true },
        where: { referenceId: userId },
      }),
    ]);

    const response = await apiContext.get("/v1/me");

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.user.analyticsDisabled).toBe(true);
    expect(body.account.subscription.cancelAt).toBe(cancelAt.toISOString());

    await apiContext.dispose();
  });

  test("returns the signed-in user through a cookie session", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "me-cookie",
    });

    const response = await apiContext.get("/v1/me");

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.user.id).toBe(user.id);

    await apiContext.dispose();
  });

  test("rejects cookie-authenticated profile updates without a same-origin Origin header", async () => {
    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "me-cookie-origin",
    });

    const storageState = await apiContext.storageState();

    const [missingOriginContext, crossOriginContext] = await Promise.all([
      request.newContext({ baseURL, storageState }),
      request.newContext({
        baseURL,
        extraHTTPHeaders: { Origin: "https://attacker.example" },
        storageState,
      }),
    ]);

    const [missingOriginResponse, crossOriginResponse] = await Promise.all([
      missingOriginContext.patch("/v1/me", { data: { name: "Missing Origin" } }),
      crossOriginContext.patch("/v1/me", { data: { name: "Cross Origin" } }),
    ]);

    await Promise.all([
      expectApiError({ code: "FORBIDDEN", response: missingOriginResponse, status: 403 }),
      expectApiError({ code: "FORBIDDEN", response: crossOriginResponse, status: 403 }),
    ]);

    await Promise.all([
      apiContext.dispose(),
      missingOriginContext.dispose(),
      crossOriginContext.dispose(),
    ]);
  });

  test("rejects cookie-authenticated account deletion without a same-origin Origin header", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "me-cookie-delete-origin",
    });

    const storageState = await apiContext.storageState();

    const [missingOriginContext, crossOriginContext] = await Promise.all([
      request.newContext({ baseURL, storageState }),
      request.newContext({
        baseURL,
        extraHTTPHeaders: { Origin: "https://attacker.example" },
        storageState,
      }),
    ]);

    const [missingOriginResponse, crossOriginResponse] = await Promise.all([
      missingOriginContext.delete("/v1/me", { data: {} }),
      crossOriginContext.delete("/v1/me", { data: {} }),
    ]);

    await Promise.all([
      expectApiError({ code: "FORBIDDEN", response: missingOriginResponse, status: 403 }),
      expectApiError({ code: "FORBIDDEN", response: crossOriginResponse, status: 403 }),
    ]);

    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.not.toBeNull();

    await Promise.all([
      apiContext.dispose(),
      missingOriginContext.dispose(),
      crossOriginContext.dispose(),
    ]);
  });

  test("allows same-origin cookie-authenticated account deletion", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "me-cookie-delete",
    });

    const response = await apiContext.delete("/v1/me", { data: {} });

    expect(response.status()).toBe(200);
    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.toBeNull();

    await apiContext.dispose();
  });

  test("allows a same-origin cookie-authenticated profile update", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "me-cookie-update",
    });

    const response = await apiContext.patch("/v1/me", {
      data: { name: "Same-origin Cookie User" },
    });

    expect(response.status()).toBe(200);

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      name: "Same-origin Cookie User",
    });

    await apiContext.dispose();
  });

  test("updates the signed-in user's profile", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { apiContext, email, userId } = await createBearerApiContext({ baseURL, uniqueId });
    const nextName = `Updated Me User ${uniqueId}`;
    const nextUsername = `updated_me_${uniqueId}`;

    const updateResponse = await apiContext.patch("/v1/me", {
      data: { name: nextName, username: nextUsername },
    });

    expect(updateResponse.status()).toBe(200);

    const updateBody = await updateResponse.json();

    expect(updateBody.user).toMatchObject({
      email,
      id: userId,
      name: nextName,
      username: nextUsername,
    });

    expect(updateBody.account.deletion.hasAppleAccount).toBe(false);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    expect(user.name).toBe(nextName);
    expect(user.username).toBe(nextUsername);

    const getResponse = await apiContext.get("/v1/me");
    const getBody = await getResponse.json();

    expect(getBody.user.name).toBe(nextName);
    expect(getBody.user.username).toBe(nextUsername);

    await apiContext.dispose();
  });

  test("rejects empty profile updates", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { apiContext } = await createBearerApiContext({ baseURL, uniqueId });

    const response = await apiContext.patch("/v1/me", { data: {} });

    await expectApiError({ code: "VALIDATION_ERROR", response, status: 400 });

    await apiContext.dispose();
  });

  test("rejects profile fields outside the public contract", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { apiContext } = await createBearerApiContext({ baseURL, uniqueId });

    const response = await apiContext.patch("/v1/me", { data: { role: "admin" } });

    await expectApiError({ code: "VALIDATION_ERROR", response, status: 400 });

    await apiContext.dispose();
  });

  test("rejects username updates outside the documented syntax contract", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { apiContext, userId, username } = await createBearerApiContext({ baseURL, uniqueId });

    const responses = await Promise.all(
      ["", "ab", "a".repeat(31), "invalid-name"].map((invalidUsername) =>
        apiContext.patch("/v1/me", { data: { username: invalidUsername } }),
      ),
    );

    await Promise.all(
      responses.map((response) =>
        expectApiError({ code: "VALIDATION_ERROR", response, status: 400 }),
      ),
    );

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    expect(user.username).toBe(username);

    await apiContext.dispose();
  });

  test("rejects username updates when the username is already taken", async () => {
    const takenUniqueId = randomUUID().slice(0, 8);
    const nextUniqueId = randomUUID().slice(0, 8);
    const taken = await createBearerApiContext({ baseURL, uniqueId: takenUniqueId });
    const next = await createBearerApiContext({ baseURL, uniqueId: nextUniqueId });

    const response = await next.apiContext.patch("/v1/me", { data: { username: taken.username } });

    await expectApiError({ code: "CONFLICT", response, status: 409 });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: next.userId } });

    expect(user.username).toBe(next.username);

    await taken.apiContext.dispose();
    await next.apiContext.dispose();
  });
});
