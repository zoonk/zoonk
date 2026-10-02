import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

/** Only this hash is stored, so a database read can't be turned into a working invite link. */
export function hashGuardianToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createGuardianToken() {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");

  return { token, tokenHash: hashGuardianToken(token) };
}
