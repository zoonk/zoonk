import { verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import { COSEALG, parseAuthenticatorData } from "@simplewebauthn/server/helpers";
import { prisma } from "@zoonk/db";
import { getAndroidApps } from "@zoonk/utils/android-apps";
import { safeAsync } from "@zoonk/utils/error";
import { z } from "zod";
import { consumeAppChallenge } from "../request-guards/app-challenge";
import { RESTORE_KEY_RP_ID } from "./restore-key-contract";

/** Android creates and reads restore keys silently, so neither user presence nor verification is set. */
const SILENT_REGISTRATION = { requireUserPresence: false, requireUserVerification: false } as const;
const SILENT_ASSERTION = { advancedFIDOConfig: { userVerification: "discouraged" } } as const;

const base64urlSchema = z.base64url();

const credentialFields = {
  clientExtensionResults: z.object({}).default({}),
  id: base64urlSchema,
  rawId: base64urlSchema,
  type: z.literal("public-key"),
};

function isAuthenticatorData(authenticatorData: string): boolean {
  try {
    const { flags } = parseAuthenticatorData(
      new Uint8Array(Buffer.from(authenticatorData, "base64url")),
    );

    return flags.be || !flags.bs;
  } catch {
    return false;
  }
}

const registrationResponseSchema = z
  .object({
    ...credentialFields,
    response: z.object({ attestationObject: base64urlSchema, clientDataJSON: base64urlSchema }),
  })
  .refine((credential) => credential.id === credential.rawId);

/**
 * Everything the verifier would refuse as malformed is checked here, so a malformed assertion
 * answers 400 and only a key that can't sign in answers 401, which makes the app delete it.
 */
const authenticationResponseSchema = z
  .object({
    ...credentialFields,
    response: z.object({
      authenticatorData: base64urlSchema.refine((data) => isAuthenticatorData(data)),
      clientDataJSON: base64urlSchema,
      signature: base64urlSchema,
    }),
  })
  .refine((credential) => credential.id === credential.rawId);

const clientDataSchema = z.object({
  challenge: z.string().min(1),
  origin: z.string(),
  type: z.string(),
});

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readChallenge({
  clientDataJSON,
  type,
}: {
  clientDataJSON: string;
  type: string;
}): string | null {
  const clientData = clientDataSchema.safeParse(
    parseJson(Buffer.from(clientDataJSON, "base64url").toString("utf8")),
  );

  return clientData.success && clientData.data.type === type ? clientData.data.challenge : null;
}

function readCredentialResponse<T extends { response: { clientDataJSON: string } }>({
  json,
  schema,
  type,
}: {
  json: string;
  schema: z.ZodType<T>;
  type: "webauthn.create" | "webauthn.get";
}) {
  const parsed = schema.safeParse(parseJson(json));

  const challenge = parsed.success
    ? readChallenge({ clientDataJSON: parsed.data.response.clientDataJSON, type })
    : null;

  return parsed.success && challenge ? { challenge, response: parsed.data } : null;
}

function toApkKeyHashOrigin(fingerprint: string): string {
  const digest = Buffer.from(fingerprint.replaceAll(":", ""), "hex");
  return `android:apk-key-hash:${digest.toString("base64url")}`;
}

function getAndroidAppOrigins(): string[] {
  return getAndroidApps()
    .flatMap((app) => app.fingerprints)
    .map((fingerprint) => toApkKeyHashOrigin(fingerprint));
}

/** An ID already bound to another session stays bound to it, so nobody can take over a key whose ID they saw. */
async function bindRestoreKey({
  id,
  publicKey,
  sessionId,
}: {
  id: string;
  publicKey: Uint8Array<ArrayBuffer>;
  sessionId: string;
}): Promise<boolean> {
  const { count } = await prisma.restoreKey.createMany({
    data: { id, publicKey, sessionId },
    skipDuplicates: true,
  });

  if (count === 1) {
    return true;
  }

  const existing = await prisma.restoreKey.findUnique({ where: { id } });
  return existing?.sessionId === sessionId;
}

export type RestoreKeyRefusal =
  | "challengeInvalid"
  | "keyInvalid"
  | "registrationInvalid"
  | "responseMalformed";

export async function registerRestoreKey({
  registrationResponseJson,
  sessionId,
}: {
  registrationResponseJson: string;
  sessionId: string;
}): Promise<RestoreKeyRefusal | null> {
  const registration = readCredentialResponse({
    json: registrationResponseJson,
    schema: registrationResponseSchema,
    type: "webauthn.create",
  });

  if (!registration) {
    return "responseMalformed";
  }

  if (!(await consumeAppChallenge(registration.challenge))) {
    return "challengeInvalid";
  }

  const { data: verification } = await safeAsync(() =>
    verifyRegistrationResponse({
      ...SILENT_REGISTRATION,
      expectedChallenge: registration.challenge,
      expectedOrigin: getAndroidAppOrigins(),
      expectedRPID: RESTORE_KEY_RP_ID,
      response: registration.response,
      supportedAlgorithmIDs: [COSEALG.ES256, COSEALG.RS256],
    }),
  );

  if (!verification?.verified) {
    return "registrationInvalid";
  }

  const { credential } = verification.registrationInfo;

  const bound = await bindRestoreKey({
    id: credential.id,
    publicKey: credential.publicKey,
    sessionId,
  });

  return bound ? null : "registrationInvalid";
}

type RestoreKeyOwner = { isAnonymous: boolean; publicKey: Uint8Array<ArrayBuffer>; userId: string };

function findRestoreKeyOwner(keyId: string) {
  return prisma.$queryRaw<RestoreKeyOwner[]>`
    SELECT k.public_key AS "publicKey", u.id AS "userId", u.is_anonymous AS "isAnonymous"
    FROM restore_keys k
    JOIN sessions s ON s.id = k.session_id
    JOIN users u ON u.id = s.user_id
    WHERE k.id = ${keyId} AND s.expires_at > ${new Date()}
  `;
}

/**
 * Answers the key's learner only while the session that registered it lasts. A spent or expired
 * challenge is refused before the key is read, so `keyInvalid` always means this key can't sign in.
 */
export async function redeemRestoreKey(
  authenticationResponseJson: string,
): Promise<
  { refusal: RestoreKeyRefusal } | { refusal: null; user: { id: string; isAnonymous: boolean } }
> {
  const assertion = readCredentialResponse({
    json: authenticationResponseJson,
    schema: authenticationResponseSchema,
    type: "webauthn.get",
  });

  if (!assertion) {
    return { refusal: "responseMalformed" };
  }

  if (!(await consumeAppChallenge(assertion.challenge))) {
    return { refusal: "challengeInvalid" };
  }

  const [owner] = await findRestoreKeyOwner(assertion.response.id);

  if (!owner) {
    return { refusal: "keyInvalid" };
  }

  const { data: verification } = await safeAsync(() =>
    verifyAuthenticationResponse({
      ...SILENT_ASSERTION,
      // Every phone restored from one backup holds the same private key, so a signature counter
      // can't tell a clone from a restore.
      credential: { counter: 0, id: assertion.response.id, publicKey: owner.publicKey },
      expectedChallenge: assertion.challenge,
      expectedOrigin: getAndroidAppOrigins(),
      expectedRPID: RESTORE_KEY_RP_ID,
      response: assertion.response,
    }),
  );

  return verification?.verified
    ? { refusal: null, user: { id: owner.userId, isAnonymous: owner.isAnonymous } }
    : { refusal: "keyInvalid" };
}
