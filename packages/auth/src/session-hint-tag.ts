import { createHmac, hkdfSync } from "node:crypto";
import { getEnvironment } from "@zoonk/utils/environment";

/** Keeps this key apart from every other use of the auth secret. */
const KEY_LABEL = "zoonk-hint-tag";
const KEY_BYTES = 32;
const TAG_BYTES = 16;

/**
 * The session hint's tag for a learner (`session-hint.ts`): the same for every session of theirs,
 * so signing in again changes nothing, and different for every learner. It's opaque: only the
 * auth secret (the one Better Auth resolved) can make it, and it never contains their id. It names
 * a learner without being a credential, so it's never logged. Preview and production differ even
 * when they share a secret; changing the secret changes every learner's tag.
 */
export function encodeSessionHintTag({ secret, userId }: { secret: string; userId: string }) {
  const key = Buffer.from(hkdfSync("sha256", secret, "", KEY_LABEL, KEY_BYTES));
  const digest = createHmac("sha256", key).update(`v1:${getEnvironment()}:${userId}`).digest();

  return `t1.${digest.subarray(0, TAG_BYTES).toString("base64url")}`;
}
