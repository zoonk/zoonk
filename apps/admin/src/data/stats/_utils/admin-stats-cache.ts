import "server-only";
import { requireAdminRouteAccess } from "@/lib/admin-guard";
import { cache } from "react";

/**
 * Stats data can be fetched by leaf route segments while App Router reuses the
 * shared private layout during client-side navigation. This wrapper keeps the
 * admin check next to the Prisma reads and keeps React's per-render memoization.
 */
export function adminStatsCache<Args extends unknown[], Result>(
  loadStats: (...args: Args) => Result | Promise<Result>,
) {
  return cache(async (...args: Args) => {
    await requireAdminRouteAccess();
    return loadStats(...args);
  });
}
