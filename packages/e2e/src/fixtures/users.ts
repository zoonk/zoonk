import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { getAiOrganization } from "./orgs";
import { createE2EProgressData } from "./progress";

const SHORT_UUID_LENGTH = 8;

export type E2EUser = {
  email: string;
  id: string;
  password: string;
  storageState: Awaited<ReturnType<Awaited<ReturnType<typeof request.newContext>>["storageState"]>>;
};

type CreateE2EUserOptions = {
  orgRole?: "admin" | "member" | "owner";
  orgSlug?: string;
  withProgress?: boolean;
  withSubscription?: boolean;
};

/**
 * Create a browser-ready user by going through the real auth API.
 * E2E tests need cookies, sessions, and Better Auth side effects to match the
 * production path, so this helper signs up, optionally attaches org access or
 * a subscription, and then returns storage state for immediate reuse.
 */
export async function createE2EUser(
  baseURL: string,
  options?: CreateE2EUserOptions,
): Promise<E2EUser> {
  const uniqueId = randomUUID().slice(0, SHORT_UUID_LENGTH);
  const email = `e2e-${uniqueId}@zoonk.test`;
  const password = "password123";
  const name = `E2E User ${uniqueId}`;

  const signupContext = await request.newContext({ baseURL });
  const signupResponse = await signupContext.post("/api/auth/sign-up/email", {
    data: { email, name, password },
  });

  if (!signupResponse.ok()) {
    const body = await signupResponse.text();
    throw new Error(`Sign-up failed for ${email}: ${signupResponse.status()} - ${body}`);
  }

  await signupContext.dispose();

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  await prisma.user.update({
    data: { username: `e2e_${uniqueId}` },
    where: { id: user.id },
  });

  if (options?.orgRole) {
    const org = options.orgSlug
      ? await prisma.organization.findUniqueOrThrow({ where: { slug: options.orgSlug } })
      : await getAiOrganization();

    await prisma.member.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        role: options.orgRole,
        userId: user.id,
      },
    });
  }

  if (options?.withSubscription) {
    await prisma.subscription.create({
      data: {
        id: randomUUID(),
        plan: "hobby",
        referenceId: user.id,
        status: "active",
        stripeCustomerId: `cus_e2e_${uniqueId}`,
        stripeSubscriptionId: `sub_e2e_${uniqueId}`,
      },
    });
  }

  if (options?.withProgress) {
    await createE2EProgressData(user.id);
  }

  const signinContext = await request.newContext({ baseURL });
  const signinResponse = await signinContext.post("/api/auth/sign-in/email", {
    data: { email, password },
  });

  if (!signinResponse.ok()) {
    const body = await signinResponse.text();
    throw new Error(`Sign-in failed for ${email}: ${signinResponse.status()} - ${body}`);
  }

  const storageState = await signinContext.storageState();
  await signinContext.dispose();

  return { email, id: user.id, password, storageState };
}

/**
 * Mint a one-time auth token for an existing browser user.
 * Tests use this to validate callback and cross-app auth flows without having
 * to reach into internal session tables directly.
 */
export async function generateOneTimeToken(baseURL: string, user: E2EUser): Promise<string> {
  const ctx = await request.newContext({
    baseURL,
    storageState: user.storageState,
  });

  const response = await ctx.get("/api/auth/one-time-token/generate");

  if (!response.ok()) {
    const body = await response.text();
    await ctx.dispose();
    throw new Error(`Failed to generate one-time token: ${response.status()} - ${body}`);
  }

  const data: unknown = await response.json();
  await ctx.dispose();

  const token = getString(data, "token");

  if (!token) {
    throw new Error("No token in one-time token response");
  }

  return token;
}
