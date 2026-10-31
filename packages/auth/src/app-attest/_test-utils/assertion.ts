import { type KeyObject, createHash, generateKeyPairSync, sign } from "node:crypto";
import {
  APP_ATTEST_OPERATIONS,
  type AppAttestBinding,
  getAppAttestClientData,
} from "../app-attest-contract";
import { RECORDED_APP } from "./recorded-attestations";

/** CBOR (RFC 8949): a value's first byte is its major type (2, 3 and 5 here) times 32, plus a short length. */
const CBOR_BYTE_STRING = 64;
const CBOR_TEXT_STRING = 96;
const CBOR_MAP = 160;
const CBOR_INLINE_LENGTH_LIMIT = 24;
const CBOR_TWO_BYTE_LENGTH = 25;

const UNCOMPRESSED_POINT = 0x04;
const USER_PRESENT_FLAG = 0x40;
const COUNTER_BYTES = 4;
const LENGTH_BYTES = 2;

function sha256(data: Buffer | string) {
  return createHash("sha256").update(data).digest();
}

function cborHead(type: number, length: number) {
  if (length < CBOR_INLINE_LENGTH_LIMIT) {
    return Buffer.from([type + length]);
  }

  const lengthBytes = Buffer.alloc(LENGTH_BYTES);
  lengthBytes.writeUInt16BE(length);

  return Buffer.concat([Buffer.from([type + CBOR_TWO_BYTE_LENGTH]), lengthBytes]);
}

function encodeAssertion(fields: Record<string, Buffer>) {
  const entries = Object.entries(fields);

  return Buffer.concat([
    cborHead(CBOR_MAP, entries.length),
    ...entries.flatMap(([key, value]) => [
      cborHead(CBOR_TEXT_STRING, key.length),
      Buffer.from(key),
      cborHead(CBOR_BYTE_STRING, value.length),
      value,
    ]),
  ]);
}

export function makeDeviceKey() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const { x = "", y = "" } = publicKey.export({ format: "jwk" });

  // Apple's key ID hashes the public key's uncompressed point.
  const point = Buffer.concat([
    Buffer.from([UNCOMPRESSED_POINT]),
    Buffer.from(x, "base64url"),
    Buffer.from(y, "base64url"),
  ]);

  return {
    keyId: sha256(point).toString("base64"),
    privateKey,
    publicKey: publicKey.export({ format: "pem", type: "spki" }).toString(),
  };
}

export function makeAssertion({
  appId = `${RECORDED_APP.teamIdentifier}.${RECORDED_APP.bundleIdentifier}`,
  binding = { fields: [], operation: APP_ATTEST_OPERATIONS.guest },
  challenge,
  counter,
  privateKey,
}: {
  appId?: string;
  binding?: AppAttestBinding;
  challenge: string;
  counter: number;
  privateKey: KeyObject;
}) {
  const counterBytes = Buffer.alloc(COUNTER_BYTES);
  counterBytes.writeUInt32BE(counter);

  const authenticatorData = Buffer.concat([
    sha256(appId),
    Buffer.from([USER_PRESENT_FLAG]),
    counterBytes,
  ]);

  const clientData = getAppAttestClientData({ binding, challenge });
  const nonce = sha256(Buffer.concat([authenticatorData, sha256(clientData)]));
  const signature = sign("sha256", nonce, privateKey);

  return encodeAssertion({ authenticatorData, signature }).toString("base64");
}
