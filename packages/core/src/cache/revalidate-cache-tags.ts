import "server-only";
import { logError } from "@zoonk/utils/logger";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { notifyAppCaches } from "./notify-app-caches";
import { isSharedContentTag } from "./tags";

/**
 * Expires cache tags right after a write, from Server Actions and Route Handlers alike, so the
 * next read in this app loads the change. Configured senders also notify Main's separate shared
 * content cache after the response. Main sets no MAIN_CACHE_URL, preventing notification loops.
 */
export function revalidateCacheTags(tags: readonly string[]): void {
  const uniqueTags = [...new Set(tags)];

  uniqueTags.forEach((tag) => {
    revalidateTag(tag, { expire: 0 });
  });

  if (!process.env.MAIN_CACHE_URL || !process.env.APP_CACHE_SECRET) {
    return;
  }

  const sharedTags = uniqueTags.filter((tag) => isSharedContentTag(tag));

  if (sharedTags.length === 0) {
    return;
  }

  try {
    after(() => notifyAppCaches(sharedTags));
  } catch (error) {
    /** When request lifetime registration is unavailable, delivery remains best effort. */
    logError("Main cache notification has no request lifetime; sending in background", error);
    void notifyAppCaches(sharedTags);
  }
}
