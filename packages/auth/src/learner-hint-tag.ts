import { auth } from "./auth";
import { encodeSessionHintTag } from "./session-hint-tag";

/**
 * The session hint's tag for a learner, as the auth responses that hold their session write it:
 * what a page rendered for them carries, so the browser can tell whether it still holds their
 * session. Server only.
 */
export async function getLearnerHintTag(userId: string): Promise<string> {
  const { secret } = await auth.$context;
  return encodeSessionHintTag({ secret, userId });
}
