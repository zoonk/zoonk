import "server-only";
import { randomBytes } from "node:crypto";
import { CERTIFICATE_CODE_ALPHABET, CERTIFICATE_CODE_LENGTH } from "../certificate-contract";

/**
 * 60 random bits: each byte picks one of 32 characters, and 256 is a multiple of 32, so every
 * character is equally likely. A collision fails the unique index and the request's retry draws
 * again.
 */
export function createCertificateCode(): string {
  return Array.from(
    randomBytes(CERTIFICATE_CODE_LENGTH),
    (byte) => CERTIFICATE_CODE_ALPHABET[byte % CERTIFICATE_CODE_ALPHABET.length],
  ).join("");
}
