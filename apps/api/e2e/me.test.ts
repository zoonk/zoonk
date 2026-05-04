import { randomUUID } from "node:crypto";
import { type APIResponse, request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { getString } from "@zoonk/utils/json";

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
        plan: "hobby",
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

  return { apiContext, email, name, userId: user.id, username };
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
    expect(body.account.hasActiveSubscription).toBe(true);

    expect(body.account.subscription).toMatchObject({
      plan: "hobby",
      provider: "zoonk",
      status: "active",
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

  test("rejects invalid username updates", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { apiContext, userId, username } = await createBearerApiContext({ baseURL, uniqueId });

    const response = await apiContext.patch("/v1/me", { data: { username: "" } });

    await expectApiError({ code: "BAD_REQUEST", response, status: 400 });

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
