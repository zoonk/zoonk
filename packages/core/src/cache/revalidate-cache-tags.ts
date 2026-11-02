import "server-only";
import { revalidateTag } from "next/cache";

/**
 * `updateTag` works only in Server Actions, and core writes also run from Route Handlers and
 * workflows; `{ expire: 0 }` expires the tags at once from all of them.
 */
export function revalidateCacheTags(tags: readonly string[]): void {
  new Set(tags).forEach((tag) => {
    revalidateTag(tag, { expire: 0 });
  });
}
