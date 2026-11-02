import "server-only";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag, getUserProgressCacheTag } from "../../cache/tags";
import { loadDuePronunciation } from "../../language/pronunciation/load-due-pronunciation";
import { getRequestInstant } from "./request-instant";

/** GET-only fact: the words due to say again at the request's instant; writes and tools read fresh. */
export async function readDuePronunciation(userId: string, language: string) {
  "use cache: private";

  cacheTag(getUserProgressCacheTag(userId), getLearnerModelCacheTag(userId));

  return loadDuePronunciation({ language, now: await getRequestInstant(), userId });
}
