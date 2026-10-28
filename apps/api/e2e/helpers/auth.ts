import { randomUUID } from "node:crypto";
import { type APIRequestContext, type APIResponse, request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";

const AUTH_UNIQUE_ID_LENGTH = 8;
const AUTH_PREFIX_MAX_LENGTH = 24;

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

function getAuthCredentials(prefix: string) {
  const uniqueId = randomUUID().slice(0, AUTH_UNIQUE_ID_LENGTH);
  const safePrefix = prefix.replaceAll(/[^a-z0-9-]/gu, "-").slice(0, AUTH_PREFIX_MAX_LENGTH);

  return { email: `e2e-${safePrefix}-${uniqueId}@zoonk.test`, password: "password123", uniqueId };
}

export async function createAuthenticatedApiContext({
  baseURL,
  prefix,
}: {
  baseURL: string;
  prefix: string;
}): Promise<{
  apiContext: APIRequestContext;
  token: string;
  uniqueId: string;
  user: { id: string };
}> {
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

  const apiContext = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: new URL(baseURL).origin },
  });

  const signInResponse = await apiContext.post("/v1/auth/sign-in/email", {
    data: { email: credentials.email, password: credentials.password },
  });

  await assertAuthResponseOk({ action: "sign in", response: signInResponse });
  const token = getString(await signInResponse.json(), "token");

  if (!token) {
    throw new Error("Sign in did not return a bearer token.");
  }

  return { apiContext, token, uniqueId: credentials.uniqueId, user };
}
