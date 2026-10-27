import "server-only";
import { revalidateTag } from "next/cache";

/**
 * Expires cache tags right after a write, from Server Actions and Route Handlers alike, so the
 * next read in this app loads the change.
 */
export function revalidateCacheTags(tags: readonly string[]): void {
  new Set(tags).forEach((tag) => {
    revalidateTag(tag, { expire: 0 });
  });
}
