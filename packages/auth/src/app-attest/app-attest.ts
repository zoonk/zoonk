import { randomBytes } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getEnvironment } from "@zoonk/utils/environment";
import { verifyAssertion, verifyAttestation } from "node-app-attest";
import { z } from "zod";
import {
  APP_ATTEST_HEADERS,
  type AppAttestBinding,
  appAttestHeadersSchema,
  getAppAttestClientData,
} from "./app-attest-contract";

const CHALLENGE_LIFETIME_MS = 300_000;
const CHALLENGE_BYTES = 32;
const CHALLENGE_IDENTIFIER_PREFIX = "app-attest-challenge:";

/** The library is untyped: these are the parts of its answers we keep. */
const verifiedAttestationSchema = z.object({ publicKey: z.string().min(1) });
const verifiedAssertionSchema = z.object({ signCount: z.number().int().positive() });

function getAppIdentity() {
  const { APPLE_APP_BUNDLE_IDENTIFIER, APPLE_TEAM_ID } = process.env;

  return APPLE_APP_BUNDLE_IDENTIFIER && APPLE_TEAM_ID
    ? { bundleIdentifier: APPLE_APP_BUNDLE_IDENTIFIER, teamIdentifier: APPLE_TEAM_ID }
    : null;
}

export async function issueAppAttestChallenge(): Promise<string> {
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
async function consumeChallenge(challenge: string): Promise<boolean> {
  const { count } = await prisma.verification.deleteMany({
    where: {
      expiresAt: { gt: new Date() },
      identifier: `${CHALLENGE_IDENTIFIER_PREFIX}${challenge}`,
    },
  });

  return count === 1;
}

/** The library throws on every failed check; any throw means the proof doesn't hold. */
function attempt<T>(verify: () => T): T | null {
  try {
    return verify();
  } catch {
    return null;
  }
}

/**
 * Keys from App Attest's development environment count everywhere but production. Registering the
 * same key again changes nothing, so its counter never goes back.
 */
export async function registerAppAttestKey({
  attestation,
  challenge,
  keyId,
}: {
  attestation: string;
  challenge: string;
  keyId: string;
}): Promise<boolean> {
  const app = getAppIdentity();

  if (!app) {
    throw new Error("App Attest needs APPLE_TEAM_ID and APPLE_APP_BUNDLE_IDENTIFIER");
  }

  if (!(await consumeChallenge(challenge))) {
    return false;
  }

  const verified = attempt(() =>
    verifiedAttestationSchema.parse(
      verifyAttestation({
        ...app,
        allowDevelopmentEnvironment: getEnvironment() !== "production",
        attestation: Buffer.from(attestation, "base64"),
        challenge,
        keyId,
      }),
    ),
  );

  if (!verified) {
    return false;
  }

  await prisma.appAttestKey.upsert({
    create: { keyId, publicKey: verified.publicKey },
    update: {},
    where: { keyId },
  });

  return true;
}

/**
 * The challenge is spent first, so no assertion counts twice; the stored counter only rises, even
 * when requests race.
 */
export async function hasAppAttestAssertion({
  binding,
  headers,
}: {
  binding: AppAttestBinding;
  headers: Headers;
}): Promise<boolean> {
  const app = getAppIdentity();

  const parsed = appAttestHeadersSchema.safeParse({
    [APP_ATTEST_HEADERS.assertion]: headers.get(APP_ATTEST_HEADERS.assertion),
    [APP_ATTEST_HEADERS.challenge]: headers.get(APP_ATTEST_HEADERS.challenge),
    [APP_ATTEST_HEADERS.keyId]: headers.get(APP_ATTEST_HEADERS.keyId),
  });

  if (!app || !parsed.success || binding.fields.some((field) => field.includes("\n"))) {
    return false;
  }

  const {
    [APP_ATTEST_HEADERS.assertion]: assertion,
    [APP_ATTEST_HEADERS.challenge]: challenge,
    [APP_ATTEST_HEADERS.keyId]: keyId,
  } = parsed.data;

  const key = await prisma.appAttestKey.findUnique({ where: { keyId } });

  if (!key || !(await consumeChallenge(challenge))) {
    return false;
  }

  const verified = attempt(() =>
    verifiedAssertionSchema.parse(
      verifyAssertion({
        ...app,
        assertion: Buffer.from(assertion, "base64"),
        payload: getAppAttestClientData({ binding, challenge }),
        publicKey: key.publicKey,
        signCount: key.signCount,
      }),
    ),
  );

  if (!verified) {
    return false;
  }

  const { count } = await prisma.appAttestKey.updateMany({
    data: { signCount: verified.signCount },
    where: { keyId, signCount: { lt: verified.signCount } },
  });

  return count === 1;
}
