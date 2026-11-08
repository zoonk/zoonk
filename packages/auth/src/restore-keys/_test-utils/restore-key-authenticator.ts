import { type KeyObject, createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { isoCBOR } from "@simplewebauthn/server/helpers";
import { RESTORE_KEY_RP_ID } from "../restore-key-contract";

/** Authenticator data flags: backed up (BE 0x08 + BS 0x10), silent (no UP 0x01, no UV 0x04). */
const BACKED_UP_FLAGS = 0x18;
const ATTESTED_BACKED_UP_FLAGS = 0x58;

const COSE_KEY = {
  alg: 3,
  crv: -1,
  exponent: -2,
  kty: 1,
  modulus: -1,
  xCoordinate: -2,
  yCoordinate: -3,
} as const;

const COSE_EC2 = 2;
const COSE_RSA = 3;
const COSE_P256 = 1;
const ES256 = -7;
const RS256 = -257;

const AAGUID_BYTES = 16;
const COUNTER_BYTES = 4;
const CREDENTIAL_ID_BYTES = 16;
const CREDENTIAL_ID_LENGTH_BYTES = 2;
const SHA256_BYTES = 32;
const USER_HANDLE_BYTES = 16;

/** The colon-hex fingerprint the API reads from its environment, and the origin Android reports for it. */
export function makeSigningCertificate() {
  const digest = randomBytes(SHA256_BYTES);

  return {
    fingerprint: digest.toString("hex").toUpperCase().match(/../gu)?.join(":") ?? "",
    origin: `android:apk-key-hash:${digest.toString("base64url")}`,
  };
}

export type RestoreKeyAuthenticator = {
  algorithm: "ES256" | "RS256";
  id: string;
  privateKey: KeyObject;
  publicKey: KeyObject;
};

export function makeRestoreKey({
  algorithm = "ES256",
  idBytes = CREDENTIAL_ID_BYTES,
}: {
  algorithm?: RestoreKeyAuthenticator["algorithm"];
  idBytes?: number;
} = {}): RestoreKeyAuthenticator {
  const pair =
    algorithm === "ES256"
      ? generateKeyPairSync("ec", { namedCurve: "P-256" })
      : generateKeyPairSync("rsa", { modulusLength: 2048 });

  return { algorithm, id: randomBytes(idBytes).toString("base64url"), ...pair };
}

function bytes(base64url = "") {
  return new Uint8Array(Buffer.from(base64url, "base64url"));
}

function encodeCoseKey({ algorithm, publicKey }: RestoreKeyAuthenticator) {
  const jwk = publicKey.export({ format: "jwk" });

  const fields: [number, number | Uint8Array][] =
    algorithm === "ES256"
      ? [
          [COSE_KEY.kty, COSE_EC2],
          [COSE_KEY.alg, ES256],
          [COSE_KEY.crv, COSE_P256],
          [COSE_KEY.xCoordinate, bytes(jwk.x)],
          [COSE_KEY.yCoordinate, bytes(jwk.y)],
        ]
      : [
          [COSE_KEY.kty, COSE_RSA],
          [COSE_KEY.alg, RS256],
          [COSE_KEY.modulus, bytes(jwk.n)],
          [COSE_KEY.exponent, bytes(jwk.e)],
        ];

  return Buffer.from(isoCBOR.encode(new Map(fields)));
}

function sha256(data: Buffer | string) {
  return createHash("sha256").update(data).digest();
}

function clientData({
  challenge,
  origin,
  type,
}: {
  challenge: string;
  origin: string;
  type: string;
}) {
  return Buffer.from(JSON.stringify({ androidPackageName: "com.zoonk", challenge, origin, type }));
}

type Ceremony = { challenge: string; origin: string; rpId?: string };

/** What Credential Manager's `CreateRestoreCredentialResponse.responseJson` holds. */
export function makeRegistrationJson({
  challenge,
  key,
  origin,
  rpId = RESTORE_KEY_RP_ID,
}: Ceremony & { key: RestoreKeyAuthenticator }) {
  const credentialId = Buffer.from(key.id, "base64url");
  const credentialIdLength = Buffer.alloc(CREDENTIAL_ID_LENGTH_BYTES);
  credentialIdLength.writeUInt16BE(credentialId.length);

  const authData = Buffer.concat([
    sha256(rpId),
    Buffer.from([ATTESTED_BACKED_UP_FLAGS]),
    Buffer.alloc(COUNTER_BYTES),
    Buffer.alloc(AAGUID_BYTES),
    credentialIdLength,
    credentialId,
    encodeCoseKey(key),
  ]);

  const attestationObject = isoCBOR.encode(
    new Map<string, string | Map<string, string> | Uint8Array>([
      ["fmt", "none"],
      ["attStmt", new Map<string, string>()],
      ["authData", new Uint8Array(authData)],
    ]),
  );

  return JSON.stringify({
    authenticatorAttachment: "platform",
    clientExtensionResults: {},
    id: key.id,
    rawId: key.id,
    response: {
      attestationObject: Buffer.from(attestationObject).toString("base64url"),
      clientDataJSON: clientData({ challenge, origin, type: "webauthn.create" }).toString(
        "base64url",
      ),
      transports: ["internal"],
    },
    type: "public-key",
  });
}

/** What Credential Manager's `RestoreCredential.authenticationResponseJson` holds. */
export function makeAssertionJson({
  challenge,
  key,
  origin,
  rpId = RESTORE_KEY_RP_ID,
  signer = key,
}: Ceremony & { key: RestoreKeyAuthenticator; signer?: RestoreKeyAuthenticator }) {
  const authenticatorData = Buffer.concat([
    sha256(rpId),
    Buffer.from([BACKED_UP_FLAGS]),
    Buffer.alloc(COUNTER_BYTES),
  ]);

  const clientDataJSON = clientData({ challenge, origin, type: "webauthn.get" });

  const signature = sign(
    "sha256",
    Buffer.concat([authenticatorData, sha256(clientDataJSON)]),
    signer.privateKey,
  );

  return JSON.stringify({
    authenticatorAttachment: "platform",
    clientExtensionResults: {},
    id: key.id,
    rawId: key.id,
    response: {
      authenticatorData: authenticatorData.toString("base64url"),
      clientDataJSON: clientDataJSON.toString("base64url"),
      signature: signature.toString("base64url"),
      userHandle: randomBytes(USER_HANDLE_BYTES).toString("base64url"),
    },
    type: "public-key",
  });
}
