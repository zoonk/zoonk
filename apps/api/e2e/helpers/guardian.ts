import { createHash, randomBytes } from "node:crypto";
import { type Browser } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { createAuthenticatedApiContext } from "./auth";
import { createBearerLearner } from "./bearer";

const INVITE_LIFETIME_MS = 86_400_000;
const TOKEN_BYTES = 32;

const TEEN_AGE = 15;

export const TEEN_BIRTH = { month: 1, year: new Date().getUTCFullYear() - TEEN_AGE };

/**
 * The invite email only exists in the guardian's inbox, so tests store an invite for a token they
 * know, hashed the same way.
 */
export async function createGuardianInvite({
  guardianEmail,
  teenId,
}: {
  guardianEmail: string;
  teenId: string;
}) {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");

  await prisma.guardianLink.create({
    data: {
      expiresAt: new Date(Date.now() + INVITE_LIFETIME_MS),
      guardianEmail,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId: teenId,
    },
  });

  return token;
}

/** A teen learner who invited a guardian, and the invite token from the email. */
export async function createTeenInvite({
  baseURL,
  guardianEmail,
}: {
  baseURL: string;
  guardianEmail: string;
}) {
  const teen = await createBearerLearner({ baseURL, prefix: "guardian-teen" });
  await teen.api.patch("/v1/me/learning-profile", { data: { birth: TEEN_BIRTH } });
  await teen.api.dispose();

  const token = await createGuardianInvite({ guardianEmail, teenId: teen.userId });
  const learner = await prisma.user.findUniqueOrThrow({ where: { id: teen.userId } });

  return { learner, token };
}

/** A signed-in guardian in the browser, with the email verified like after an email code. */
export async function openAsGuardian({ baseURL, browser }: { baseURL: string; browser: Browser }) {
  const { apiContext, user } = await createAuthenticatedApiContext({ baseURL, prefix: "guardian" });

  const guardian = await prisma.user.update({
    data: { emailVerified: true },
    where: { id: user.id },
  });

  const context = await browser.newContext({ storageState: await apiContext.storageState() });
  await apiContext.dispose();

  return { context, guardian, page: await context.newPage() };
}
