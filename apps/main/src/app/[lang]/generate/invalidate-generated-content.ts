import "server-only";
import { updateTag } from "next/cache";

/**
 * Expires the known main-app cache entries immediately before redirecting from
 * generation. The caller already loaded every identity used to build these
 * tags, so invalidation does not need another database query.
 */
export function invalidateGeneratedContent(tags: readonly string[]): void {
  tags.forEach((tag) => updateTag(tag));
}
