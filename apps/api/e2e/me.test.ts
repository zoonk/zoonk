import { randomUUID } from "node:crypto";
import { type APIResponse, request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { appleAccountFixture } from "@zoonk/testing/fixtures/accounts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getString } from "@zoonk/utils/json";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { getOTPForEmail } from "./helpers/db";

const PASSWORD = "password123";

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

  test("refuses reads, updates and deletion without a session", async () => {
    const apiContext = await request.newContext({ baseURL });

    const responses = await Promise.all([
      apiContext.get("/v1/me"),
      apiContext.patch("/v1/me", { data: { name: "Unauthenticated User" } }),
      apiContext.delete("/v1/me", { data: {} }),
    ]);

    await Promise.all(
      responses.map((response) => expectApiError({ code: "UNAUTHORIZED", response, status: 401 })),
    );

    await apiContext.dispose();
  });

  test("returns the signed-in user and account state", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const cancelAt = new Date("2027-01-15T12:00:00.000Z");

    const { apiContext, email, name, userId, username } = await createBearerApiContext({
      baseURL,
      uniqueId,
      withSubscription: true,
    });

    await Promise.all([
      appleAccountFixture({ userId }),
      prisma.user.update({ data: { analyticsDisabled: true }, where: { id: userId } }),
    ]);

    const response = await apiContext.get("/v1/me");

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.user).toMatchObject({
      analyticsDisabled: true,
      email,
      emailVerified: false,
      id: userId,
      name,
      username,
    });

    expect(body.account).toMatchObject({
      deletion: { hasAppleAccount: true },
      hasActiveSubscription: true,
      subscription: { plan: "plus", provider: "zoonk", status: "active" },
    });

    await prisma.subscription.updateMany({
      data: { cancelAt, cancelAtPeriodEnd: true },
      where: { referenceId: userId },
    });

    const scheduled = await apiContext.get("/v1/me");

    await expect(scheduled.json()).resolves.toMatchObject({
      account: { subscription: { cancelAt: cancelAt.toISOString() } },
    });

    await apiContext.dispose();
  });

  test("updates the signed-in user's profile and refuses updates outside its contract", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const takenUsername = `taken_me_${uniqueId}`;

    const [{ apiContext, email, userId, username }, taken] = await Promise.all([
      createBearerApiContext({ baseURL, uniqueId }),
      userFixture(),
    ]);

    await Promise.all([
      appleAccountFixture({ userId }),
      prisma.user.update({ data: { username: takenUsername }, where: { id: taken.id } }),
    ]);

    // A taken username; an empty update, fields outside the public contract and usernames outside
    // its documented syntax.
    const [conflict, ...invalid] = await Promise.all([
      apiContext.patch("/v1/me", { data: { username: takenUsername } }),
      apiContext.patch("/v1/me", { data: {} }),
      apiContext.patch("/v1/me", { data: { role: "admin" } }),
      ...["", "ab", "a".repeat(31), "invalid-name"].map((invalidUsername) =>
        apiContext.patch("/v1/me", { data: { username: invalidUsername } }),
      ),
    ]);

    await Promise.all([
      expectApiError({ code: "CONFLICT", response: conflict, status: 409 }),
      ...invalid.map((response) =>
        expectApiError({ code: "VALIDATION_ERROR", response, status: 400 }),
      ),
    ]);

    await expect(prisma.user.findUniqueOrThrow({ where: { id: userId } })).resolves.toMatchObject({
      username,
    });

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

    // The update answers with the account's state, as reads do.
    expect(updateBody.account.deletion.hasAppleAccount).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    expect(user.name).toBe(nextName);
    expect(user.username).toBe(nextUsername);

    const getResponse = await apiContext.get("/v1/me");
    const getBody = await getResponse.json();

    expect(getBody.user.name).toBe(nextName);
    expect(getBody.user.username).toBe(nextUsername);

    await apiContext.dispose();
  });

  test("serves a cookie session, whose updates and deletion need a same-origin Origin header", async () => {
    const { apiContext, uniqueId, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "me-cookie",
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

    const read = await apiContext.get("/v1/me");

    expect(read.status()).toBe(200);
    await expect(read.json()).resolves.toMatchObject({ user: { id: user.id } });

    const refused = await Promise.all([
      missingOriginContext.patch("/v1/me", { data: { name: "Missing Origin" } }),
      crossOriginContext.patch("/v1/me", { data: { name: "Cross Origin" } }),
      missingOriginContext.delete("/v1/me", { data: {} }),
      crossOriginContext.delete("/v1/me", { data: {} }),
    ]);

    await Promise.all(
      refused.map((response) => expectApiError({ code: "FORBIDDEN", response, status: 403 })),
    );

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      name: `E2E User ${uniqueId}`,
    });

    const updated = await apiContext.patch("/v1/me", { data: { name: "Same-origin Cookie User" } });

    expect(updated.status()).toBe(200);

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      name: "Same-origin Cookie User",
    });

    const deleted = await apiContext.delete("/v1/me", { data: {} });

    expect(deleted.status()).toBe(200);
    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.toBeNull();

    await Promise.all([
      apiContext.dispose(),
      missingOriginContext.dispose(),
      crossOriginContext.dispose(),
    ]);
  });

  test("deletes an account with a stale session only after email OTP reauthentication", async () => {
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

    // The refusal sets Better Auth's session cache cookie, which a native client never sends back
    // (its requests keep no cookies), so it comes from a request context of its own.
    const staleContext = await request.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });

    const stale = await staleContext.delete("/v1/me", { data: {} });

    await expectApiError({ code: "FORBIDDEN", response: stale, status: 403 });
    await staleContext.dispose();
    await expect(prisma.user.findUnique({ where: { id: userId } })).resolves.not.toBeNull();

    const otpResponse = await apiContext.post("/v1/email-sign-in-codes", { data: { email } });

    expect(otpResponse.status()).toBe(204);

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

    await apiContext.dispose();
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

    const [ownGoal, otherGoal] = await Promise.all([
      goalFixture({ primaryCourseId: sharedCourse.id, userId }),
      goalFixture({ primaryCourseId: sharedCourse.id, userId: otherUser.id }),
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
      deletedGoal,
      preservedGoal,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.account.count({ where: { userId } }),
      prisma.session.count({ where: { token, userId } }),
      prisma.userProgress.count({ where: { userId } }),
      prisma.subscription.count({ where: { referenceId: userId } }),
      prisma.verification.count({ where: { identifier: otpIdentifier } }),
      prisma.course.findUnique({ where: { id: personalizedCourse.id } }),
      prisma.course.findUnique({ where: { id: sharedCourse.id } }),
      prisma.goal.findUnique({ where: { id: ownGoal.id } }),
      prisma.goal.findUnique({ where: { id: otherGoal.id } }),
    ]);

    expect(user).toBeNull();
    expect(accountCount).toBe(0);
    expect(sessionCount).toBe(0);
    expect(progressCount).toBe(0);
    expect(subscriptionCount).toBe(0);
    expect(verificationCount).toBe(0);
    expect(deletedCourse).toBeNull();
    expect(preservedSharedCourse).not.toBeNull();
    expect(deletedGoal).toBeNull();
    expect(preservedGoal).not.toBeNull();

    const accountResponse = await apiContext.get("/v1/me");

    await expectApiError({ code: "UNAUTHORIZED", response: accountResponse, status: 401 });

    await Promise.all([apiContext.dispose(), otpContext.dispose()]);
  });
});
