import "server-only";
import { revalidateTag } from "next/cache";

/**
 * Expires cache tags right after a write, from Server Actions and Route Handlers alike, so the
 * next read in this app loads the change. Each Next.js app keeps its own cache: another app shows
 * written content after the default revalidation, and shared reads never keep a state another app
 * is still writing (see `getPlayableLibraryLesson`).
 */
export function revalidateCacheTags(tags: readonly string[]): void {
  tags.forEach((tag) => {
    revalidateTag(tag, { expire: 0 });
  });
}
