import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getString } from "@zoonk/utils/json";
import { cleanupVerifications, getOTPForEmail } from "./helpers/db";

const TEST_RUN_ID = randomUUID().slice(0, 8);
const BANNED_EMAIL = `e2e-session-banned-${TEST_RUN_ID}@zoonk.test`;
const INVALID_CODE_EMAIL = `e2e-session-invalid-${TEST_RUN_ID}@zoonk.test`;
const SESSION_EMAIL = `e2e-session-${TEST_RUN_ID}@zoonk.test`;
const TEST_EMAILS = [BANNED_EMAIL, INVALID_CODE_EMAIL, SESSION_EMAIL];

async function requestEmailCode({ baseURL, email }: { baseURL: string; email: string }) {
  const apiContext = await request.newContext({ baseURL });
  const response = await apiContext.post("/v1/email-sign-in-codes", { data: { email } });

  expect(response.status()).toBe(204);
  await apiContext.dispose();

  const code = await getOTPForEmail(email);

  if (!code) {
    throw new Error("Email sign-in code was not stored");
  }

  return code;
}

test.describe("Native session API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await Promise.all([
      ...TEST_EMAILS.map((email) => cleanupVerifications(email)),
      prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } }),
    ]);

    await prisma.$disconnect();
  });

  test("creates, authorizes, and deletes a bearer session", async () => {
    const code = await requestEmailCode({ baseURL, email: SESSION_EMAIL });
    const publicContext = await request.newContext({ baseURL });

    const sessionResponse = await publicContext.post("/v1/sessions/email-code", {
      data: { code, email: SESSION_EMAIL },
    });

    expect(sessionResponse.status(), await sessionResponse.text()).toBe(200);

    const token = getString(await sessionResponse.json(), "token");

    if (!token) {
      throw new Error("Email code exchange did not return a bearer token");
    }

    const session = await prisma.session.findUniqueOrThrow({ where: { token } });

    const bearerContext = await request.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });

    const accountResponse = await bearerContext.get("/v1/me");
    expect(accountResponse.status()).toBe(200);

    await expect(accountResponse.json()).resolves.toMatchObject({
      user: { email: SESSION_EMAIL, id: session.userId },
    });

    const signOutResponse = await bearerContext.delete("/v1/sessions/current");
    expect(signOutResponse.status()).toBe(204);
    await expect(prisma.session.findUnique({ where: { token } })).resolves.toBeNull();

    const retryBearerContext = await request.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });

    const repeatedSignOutResponse = await retryBearerContext.delete("/v1/sessions/current");
    expect(repeatedSignOutResponse.status()).toBe(204);

    const signedOutResponse = await bearerContext.get("/v1/me");
    expect(signedOutResponse.status()).toBe(401);

    await Promise.all([
      bearerContext.dispose(),
      publicContext.dispose(),
      retryBearerContext.dispose(),
    ]);
  });

  test("returns a stable error for an incorrect email code", async () => {
    const code = await requestEmailCode({ baseURL, email: INVALID_CODE_EMAIL });
    const incorrectCode = code === "000000" ? "111111" : "000000";
    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/sessions/email-code", {
      data: { code: incorrectCode, email: INVALID_CODE_EMAIL },
    });

    expect(response.status()).toBe(400);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "EMAIL_SIGN_IN_CODE_INVALID" },
    });

    await apiContext.dispose();
  });

  test("returns a stable error when the account is disabled", async () => {
    const user = await userFixture({ email: BANNED_EMAIL });
    await prisma.user.update({ data: { banned: true }, where: { id: user.id } });
    const code = await requestEmailCode({ baseURL, email: BANNED_EMAIL });
    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/sessions/email-code", {
      data: { code, email: BANNED_EMAIL },
    });

    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "ACCOUNT_DISABLED" } });

    await apiContext.dispose();
  });

  test("treats unauthenticated sign-out as an idempotent no-op", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.delete("/v1/sessions/current");

    expect(response.status()).toBe(204);

    await apiContext.dispose();
  });

  test("validates native provider credentials on the product contract", async () => {
    const apiContext = await request.newContext({ baseURL });

    const [appleResponse, googleResponse] = await Promise.all([
      apiContext.post("/v1/sessions/apple", { data: {} }),
      apiContext.post("/v1/sessions/google", { data: { idToken: "" } }),
    ]);

    expect(appleResponse.status()).toBe(400);
    expect(googleResponse.status()).toBe(400);

    await expect(appleResponse.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });

    await expect(googleResponse.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });

    await apiContext.dispose();
  });
});
