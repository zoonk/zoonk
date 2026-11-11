import { prisma } from "@zoonk/db";
import {
  type RestoreKeyAuthenticator,
  encodeCoseKey,
  makeAssertionJson,
  makeRestoreKey,
} from "../../restore-keys/_test-utils/restore-key-authenticator";
import { type PasskeyAssertion } from "../passkey-approval-contract";
import { PASSKEY_APPROVAL_ORIGIN, PASSKEY_RP_ID } from "../relying-party";

/** Authenticator data flags: user present, user verified, and backed up (BE + BS). */
const FLAGS = { backedUp: 0x18, userPresent: 0x01, userVerified: 0x04 } as const;
const VERIFIED_FLAGS = FLAGS.userPresent + FLAGS.userVerified + FLAGS.backedUp;
const PRESENT_ONLY_FLAGS = FLAGS.userPresent + FLAGS.backedUp;

/** A passkey the person added in Main, stored the way Better Auth's passkey plugin stores it. */
export async function passkeyFixture(userId: string): Promise<RestoreKeyAuthenticator> {
  const key = makeRestoreKey();

  await prisma.passkey.create({
    data: {
      backedUp: true,
      counter: 0,
      credentialID: key.id,
      deviceType: "multiDevice",
      publicKey: encodeCoseKey(key).toString("base64"),
      transports: "internal",
      userId,
    },
  });

  return key;
}

/** What `@simplewebauthn/browser` hands Admin after the person approves with this passkey. */
export function signApproval({
  challenge,
  key,
  origin = PASSKEY_APPROVAL_ORIGIN,
  userVerified = true,
}: {
  challenge: string;
  key: RestoreKeyAuthenticator;
  origin?: string;
  userVerified?: boolean;
}): PasskeyAssertion {
  const json = makeAssertionJson({
    challenge,
    flags: userVerified ? VERIFIED_FLAGS : PRESENT_ONLY_FLAGS,
    key,
    origin,
    rpId: PASSKEY_RP_ID,
  });

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the authenticator writes this shape
  return JSON.parse(json) as PasskeyAssertion;
}
