import { verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import { COSEALG, parseAuthenticatorData } from "@simplewebauthn/server/helpers";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { getAndroidApps } from "@zoonk/utils/android-apps";
import { getEnvironment } from "@zoonk/utils/environment";
import { safeAsync } from "@zoonk/utils/error";
import { z } from "zod";
import { APP_ATTEST_OPERATIONS } from "../app-attest/app-attest-contract";
import { GOOGLE_PLAY_PACKAGE_NAME } from "../google/service-account";
import { hasPlayIntegrityProof } from "../play-integrity/play-integrity";
import { PLAY_INTEGRITY_HEADERS } from "../play-integrity/play-integrity-contract";
import { consumeAppChallenge } from "../request-guards/app-challenge";
import { RESTORE_KEY_RP_ID } from "./restore-key-contract";

/** Android creates and reads restore keys silently, so neither user presence nor verification is set. */
const SILENT_REGISTRATION = { requireUserPresence: false, requireUserVerification: false } as const;
const SILENT_ASSERTION = { advancedFIDOConfig: { userVerification: "discouraged" } } as const;

const MAX_CREDENTIAL_ID_BYTES = 1023;
const SHA256_HEX = /^[\da-f]{64}$/iu;
const ANDROID_APP_ORIGIN = /^android:apk-key-hash:[\w-]+$/u;

const base64urlSchema = z.base64url();

const credentialFields = {
  clientExtensionResults: z.object({}).default({}),
  id: base64urlSchema.refine(
    (id) => Buffer.from(id, "base64url").length <= MAX_CREDENTIAL_ID_BYTES,
  ),
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
  origin: z.string().regex(ANDROID_APP_ORIGIN),
  type: z.string(),
});

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readClientData({ clientDataJSON, type }: { clientDataJSON: string; type: string }) {
  const clientData = clientDataSchema.safeParse(
    parseJson(Buffer.from(clientDataJSON, "base64url").toString("utf8")),
  );

  return clientData.success && clientData.data.type === type ? clientData.data : null;
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

  const clientData = parsed.success
    ? readClientData({ clientDataJSON: parsed.data.response.clientDataJSON, type })
    : null;

  return parsed.success && clientData ? { clientData, response: parsed.data } : null;
}

function toApkKeyHashOrigin(fingerprint: string): string {
  const hex = fingerprint.replaceAll(":", "");

  if (!SHA256_HEX.test(hex)) {
    throw new Error(`This Android signing fingerprint isn't a SHA-256 digest: ${fingerprint}`);
  }

  return `android:apk-key-hash:${Buffer.from(hex, "hex").toString("base64url")}`;
}

/**
 * Throws instead of refusing: without the app that made a key, it would look invalid, and the app
 * deletes a key it's told is invalid. Production's keys come from the release app, so production
 * needs its fingerprints; elsewhere either app's will do.
 */
function getAndroidAppOrigins(): string[] {
  const apps = getAndroidApps();

  const requiredApps =
    getEnvironment() === "production"
      ? apps.filter((app) => app.packageName === GOOGLE_PLAY_PACKAGE_NAME)
      : apps;

  if (requiredApps.every((app) => app.fingerprints.length === 0)) {
    throw new Error("Set ANDROID_RELEASE_CERT_FINGERPRINTS to accept restore keys");
  }

  return apps
    .flatMap((app) => app.fingerprints)
    .map((fingerprint) => toApkKeyHashOrigin(fingerprint));
}

/**
 * A stolen bearer could otherwise register a key it made itself, so production takes a key only
 * from Play's copy of the app on a certified device. Debug builds can't make a token production
 * accepts, so previews and local runs go without one, but a proof that's sent is still checked.
 */
async function hasAppProof({ credentialId, headers }: { credentialId: string; headers: Headers }) {
  const sentProof =
    headers.has(PLAY_INTEGRITY_HEADERS.token) || headers.has(PLAY_INTEGRITY_HEADERS.challenge);

  if (!sentProof) {
    return getEnvironment() !== "production";
  }

  return hasPlayIntegrityProof({
    binding: { fields: [credentialId], operation: APP_ATTEST_OPERATIONS.restoreKey },
    headers,
  });
}

/**
 * One key per session, so a new key replaces the session's previous one. An ID bound to another
 * session stays bound to it, so nobody can take over a key whose ID they saw.
 */
async function bindRestoreKey({
  id,
  publicKey,
  sessionId,
}: {
  id: string;
  publicKey: Uint8Array<ArrayBuffer>;
  sessionId: string;
}): Promise<boolean> {
  const { error } = await safeAsync(() =>
    prisma.restoreKey.upsert({
      create: { id, publicKey, sessionId },
      update: { createdAt: new Date(), id, publicKey },
      where: { sessionId },
    }),
  );

  if (isPrismaUniqueConstraintError(error)) {
    return false;
  }

  if (error) {
    throw error;
  }

  return true;
}

export type RestoreKeyRefusal =
  | "appProofInvalid"
  | "challengeInvalid"
  | "keyInvalid"
  | "registrationInvalid"
  | "responseMalformed";

export async function registerRestoreKey({
  headers,
  registrationResponseJson,
  session,
}: {
  headers: Headers;
  registrationResponseJson: string;
  session: { id: string; impersonatedBy?: string | null };
}): Promise<RestoreKeyRefusal | null> {
  const expectedOrigin = getAndroidAppOrigins();

  // An admin acting as a learner never leaves behind a key that outlasts the impersonation.
  if (session.impersonatedBy) {
    return "registrationInvalid";
  }

  const registration = readCredentialResponse({
    json: registrationResponseJson,
    schema: registrationResponseSchema,
    type: "webauthn.create",
  });

  if (!registration) {
    return "responseMalformed";
  }

  if (!(await hasAppProof({ credentialId: registration.response.id, headers }))) {
    return "appProofInvalid";
  }

  if (!(await consumeAppChallenge(registration.clientData.challenge))) {
    return "challengeInvalid";
  }

  const { data: verification } = await safeAsync(() =>
    verifyRegistrationResponse({
      ...SILENT_REGISTRATION,
      expectedChallenge: registration.clientData.challenge,
      expectedOrigin,
      expectedRPID: RESTORE_KEY_RP_ID,
      response: registration.response,
      supportedAlgorithmIDs: [COSEALG.ES256, COSEALG.RS256],
    }),
  );

  if (
    !verification?.verified ||
    verification.registrationInfo.credential.id !== registration.response.id
  ) {
    return "registrationInvalid";
  }

  const bound = await bindRestoreKey({
    id: registration.response.id,
    publicKey: verification.registrationInfo.credential.publicKey,
    sessionId: session.id,
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
  const configuredOrigins = getAndroidAppOrigins();

  const assertion = readCredentialResponse({
    json: authenticationResponseJson,
    schema: authenticationResponseSchema,
    type: "webauthn.get",
  });

  if (!assertion) {
    return { refusal: "responseMalformed" };
  }

  if (!(await consumeAppChallenge(assertion.clientData.challenge))) {
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
      expectedChallenge: assertion.clientData.challenge,
      expectedOrigin: assertion.clientData.origin,
      expectedRPID: RESTORE_KEY_RP_ID,
      response: assertion.response,
    }),
  );

  if (!verification?.verified) {
    return { refusal: "keyInvalid" };
  }

  // Registration checked this origin and only the phone holding the key can sign, so an origin the
  // config doesn't list means the configured certificates changed, not that the key is dead.
  if (!configuredOrigins.includes(assertion.clientData.origin)) {
    throw new Error(
      `A restore key signed in from an app whose certificate isn't configured: ${assertion.clientData.origin}`,
    );
  }

  return { refusal: null, user: { id: owner.userId, isAnonymous: owner.isAnonymous } };
}
