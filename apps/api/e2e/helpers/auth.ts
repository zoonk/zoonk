import { randomUUID } from "node:crypto";
import { type APIRequestContext, type APIResponse, request } from "@playwright/test";
import { prisma } from "@zoonk/db";

const AUTH_UNIQUE_ID_LENGTH = 8;
const AUTH_PREFIX_MAX_LENGTH = 24;

/**
 * Fails auth setup with the upstream response body so workflow tests do not
 * hide a broken signup or signin request behind a later 401 assertion.
 */
async function assertAuthResponseOk({
  action,
  response,
}: {
  action: string;
  response: APIResponse;
}) {
  if (response.ok()) {
    return;
  }

  throw new Error(`${action} failed with ${response.status()}: ${await response.text()}`);
}

/**
 * Builds stable but unique test credentials for API workflow auth tests. The
 * prefix keeps failures searchable by workflow while the UUID prevents parallel
 * test workers from sharing Better Auth users.
 */
function getAuthCredentials(prefix: string) {
  const uniqueId = randomUUID().slice(0, AUTH_UNIQUE_ID_LENGTH);
  const safePrefix = prefix.replaceAll(/[^a-z0-9-]/gu, "-").slice(0, AUTH_PREFIX_MAX_LENGTH);

  return { email: `e2e-${safePrefix}-${uniqueId}@zoonk.test`, password: "password123", uniqueId };
}

/**
 * Creates a real Better Auth session for API route tests. Workflow triggers now
 * reject anonymous requests before parsing route-specific details, so tests
 * that exercise validation, 404s, or subscription checks need authenticated
 * request contexts rather than direct database session shortcuts.
 */
export async function createAuthenticatedApiContext({
  baseURL,
  prefix,
}: {
  baseURL: string;
  prefix: string;
}): Promise<{ apiContext: APIRequestContext; uniqueId: string; user: { id: string } }> {
  const credentials = getAuthCredentials(prefix);
  const signupContext = await request.newContext({ baseURL });

  const signupResponse = await signupContext.post("/v1/auth/sign-up/email", {
    data: {
      email: credentials.email,
      name: `E2E User ${credentials.uniqueId}`,
      password: credentials.password,
    },
  });

  await assertAuthResponseOk({ action: "sign up", response: signupResponse });
  await signupContext.dispose();

  const user = await prisma.user.findUniqueOrThrow({ where: { email: credentials.email } });
  const apiContext = await request.newContext({ baseURL });

  const signInResponse = await apiContext.post("/v1/auth/sign-in/email", {
    data: { email: credentials.email, password: credentials.password },
  });

  await assertAuthResponseOk({ action: "sign in", response: signInResponse });

  return { apiContext, uniqueId: credentials.uniqueId, user };
}

/**
 * Adds the active subscription row expected by workflow trigger routes that
 * still require a paid plan after the user is authenticated.
 */
export async function createSubscribedApiContext({
  baseURL,
  prefix,
}: {
  baseURL: string;
  prefix: string;
}) {
  const authContext = await createAuthenticatedApiContext({ baseURL, prefix });

  await prisma.subscription.create({
    data: {
      id: randomUUID(),
      plan: "hobby",
      referenceId: authContext.user.id,
      status: "active",
      stripeCustomerId: `cus_test_${authContext.uniqueId}`,
      stripeSubscriptionId: `sub_test_${authContext.uniqueId}`,
    },
  });

  return authContext;
}
