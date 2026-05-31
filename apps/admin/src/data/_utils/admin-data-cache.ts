import "server-only";
import { requireAdminRouteAccess } from "@/lib/admin-guard";
import { cache } from "react";

/**
 * Admin data helpers read private database rows from independently streamed
 * route segments, so the permission check belongs beside the query instead of
 * only in the shared layout.
 */
export function cacheAdminData<Args extends unknown[], Result>(
  loadData: (...args: Args) => Result | Promise<Result>,
) {
  return cache(async (...args: Args) => {
    await requireAdminRouteAccess();
    return loadData(...args);
  });
}
