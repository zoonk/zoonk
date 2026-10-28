import "server-only";
import { revalidateTag } from "next/cache";

export function revalidateCacheTags(tags: readonly string[]): void {
  new Set(tags).forEach((tag) => {
    revalidateTag(tag, { expire: 0 });
  });
}
