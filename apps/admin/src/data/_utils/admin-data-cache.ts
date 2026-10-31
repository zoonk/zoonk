import "server-only";
import { requireAdminRouteAccess } from "@/lib/admin-guard";
import { cache } from "react";

/**
 * Streamed route segments render without the layout's guard, so the admin check runs beside each
 * query.
 */
export function cacheAdminData<Args extends unknown[], Result>(
  loadData: (...args: Args) => Result | Promise<Result>,
) {
  return cache(async (...args: Args) => {
    await requireAdminRouteAccess();
    return loadData(...args);
  });
}
