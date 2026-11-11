import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type PasskeyApprovalOptions, type PasskeyAssertion } from "./passkey-approval-contract";
import { PASSKEY_APPROVAL_ORIGIN, PASSKEY_RP_ID } from "./relying-party";

const APPROVAL_TIMEOUT_MS = 300_000;

/**
 * Asks for one of `userId`'s own passkeys with user verification, under a new challenge the caller
 * stores and later passes to `verifyPasskeyApproval`. Null when the person has no passkey.
 */
export async function createPasskeyApprovalOptions(
  userId: string,
): Promise<PasskeyApprovalOptions | null> {
  const passkeys = await prisma.passkey.findMany({
    select: { credentialID: true, transports: true },
    where: { userId },
  });

  if (passkeys.length === 0) {
    return null;
  }

  const options = await generateAuthenticationOptions({
    allowCredentials: passkeys.map((passkey) => ({
      id: passkey.credentialID,
      transports: passkey.transports ? passkey.transports.split(",") : undefined,
    })),
    rpID: PASSKEY_RP_ID,
    timeout: APPROVAL_TIMEOUT_MS,
    userVerification: "required",
  });

  return {
    allowCredentials: (options.allowCredentials ?? []).map((credential) => ({
      id: credential.id,
      transports: credential.transports,
      type: "public-key",
    })),
    challenge: options.challenge,
    rpId: PASSKEY_RP_ID,
    timeout: APPROVAL_TIMEOUT_MS,
    userVerification: "required",
  };
}

/**
 * True only for an assertion `userId`'s own passkey signed over `expectedChallenge` on Admin's
 * page with user verification. It records the passkey's new signature counter, and never signs
 * anyone in.
 */
export async function verifyPasskeyApproval({
  assertion,
  expectedChallenge,
  userId,
}: {
  assertion: PasskeyAssertion;
  expectedChallenge: string;
  userId: string;
}): Promise<boolean> {
  const passkey = await prisma.passkey.findFirst({ where: { credentialID: assertion.id, userId } });

  if (!passkey) {
    return false;
  }

  const { data: verification } = await safeAsync(() =>
    verifyAuthenticationResponse({
      credential: {
        counter: passkey.counter,
        id: passkey.credentialID,
        publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64")),
      },
      expectedChallenge,
      expectedOrigin: PASSKEY_APPROVAL_ORIGIN,
      expectedRPID: PASSKEY_RP_ID,
      requireUserVerification: true,
      response: assertion,
    }),
  );

  if (!verification?.verified) {
    return false;
  }

  const { count } = await prisma.passkey.updateMany({
    data: { counter: verification.authenticationInfo.newCounter },
    where: { counter: passkey.counter, id: passkey.id },
  });

  return count === 1;
}
