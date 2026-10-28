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

/** A challenge is for the attestation or assertion the app makes right after asking for it. */
const CHALLENGE_LIFETIME_MS = 300_000;
const CHALLENGE_BYTES = 32;
const CHALLENGE_IDENTIFIER_PREFIX = "app-attest-challenge:";

/** The library is untyped: these are the parts of its answers we keep. */
const verifiedAttestationSchema = z.object({ publicKey: z.string().min(1) });
const verifiedAssertionSchema = z.object({ signCount: z.number().int().positive() });

/**
 * The app's App ID (team + bundle identifier), the same values Sign in with Apple uses. Each
 * environment names its own app: the production API the App Store app, previews the dev build.
 */
function getAppIdentity() {
  const { APPLE_APP_BUNDLE_IDENTIFIER, APPLE_TEAM_ID } = process.env;

  return APPLE_APP_BUNDLE_IDENTIFIER && APPLE_TEAM_ID
    ? { bundleIdentifier: APPLE_APP_BUNDLE_IDENTIFIER, teamIdentifier: APPLE_TEAM_ID }
    : null;
}

/**
 * Keeps a fresh challenge in auth's verifications, which the daily sweep clears once expired.
 * Each one proves a single attestation or assertion was made after the server asked for it.
 */
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
 * Registers a key one install of the app made and Apple attested, after checking the
 * attestation's certificate chain to Apple's App Attest root, that it signed this server's
 * challenge, and that it names this app. Keys from App Attest's development environment count
 * everywhere but production. A build signed by our team can still choose the production
 * environment; only our team can sign this App ID, so that's accepted. Registering the same key
 * again changes nothing, so its counter never goes back.
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
 * Checks a request's App Attest assertion: signed by a registered key over a challenge this
 * server issued and over the request itself (its operation and fields), for this app, with a
 * counter above the last one accepted. The challenge is spent first, so no assertion counts twice;
 * the stored counter only rises, even when requests race.
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
