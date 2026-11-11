import { prisma } from "@zoonk/db";
import { getEnvironment } from "@zoonk/utils/environment";
import { verifyAttestation } from "node-app-attest";
import { z } from "zod";
import { consumeAppChallenge } from "../request-guards/app-challenge";

/** The library is untyped: these are the parts of its answers we keep. */
const verifiedAttestationSchema = z.object({ publicKey: z.string().min(1) });

function getAppIdentity() {
  const { APPLE_APP_BUNDLE_IDENTIFIER, APPLE_TEAM_ID } = process.env;

  return APPLE_APP_BUNDLE_IDENTIFIER && APPLE_TEAM_ID
    ? { bundleIdentifier: APPLE_APP_BUNDLE_IDENTIFIER, teamIdentifier: APPLE_TEAM_ID }
    : null;
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

  if (!(await consumeAppChallenge(challenge))) {
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
