import { randomBytes } from "node:crypto";
import { prisma } from "@zoonk/db";

const CHALLENGE_LIFETIME_MS = 300_000;
const CHALLENGE_BYTES = 32;
const CHALLENGE_IDENTIFIER_PREFIX = "app-attest-challenge:";

export async function issueAppChallenge(): Promise<string> {
  const challenge = randomBytes(CHALLENGE_BYTES).toString("base64url");

  await prisma.verification.create({
    data: {
      expiresAt: new Date(Date.now() + CHALLENGE_LIFETIME_MS),
      identifier: `${CHALLENGE_IDENTIFIER_PREFIX}${challenge}`,
      value: "app-attest",
    },
  });

  return challenge;
}

/** Uses a challenge up in one statement, so two requests can't both spend it. */
export async function consumeAppChallenge(challenge: string): Promise<boolean> {
  const { count } = await prisma.verification.deleteMany({
    where: {
      expiresAt: { gt: new Date() },
      identifier: `${CHALLENGE_IDENTIFIER_PREFIX}${challenge}`,
    },
  });

  return count === 1;
}
