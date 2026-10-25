import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Where next-intl's extraction writes an app's catalogs: in place under `next dev`, as files
 * change. A build reads them as the app's `extract:messages` wrote them before it, and its own
 * extraction goes to a scratch directory: next-intl rewrites a catalog in place (emptying it
 * first) while the build reads it, and a build that reads one mid-write has none of its messages.
 *
 * @public Each app's `next.config.ts` consumes it.
 */
export function getExtractPath(app: string): string {
  return process.env.NODE_ENV === "development"
    ? "./messages"
    : join(tmpdir(), `zoonk-${app}-message-extraction`);
}
