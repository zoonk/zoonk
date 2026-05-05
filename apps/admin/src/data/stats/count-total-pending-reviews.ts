import "server-only";
import { countPendingReviews } from "@/data/review/count-pending-reviews";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";

export const countTotalPendingReviews = cache(async () => {
  const counts = await countPendingReviews();
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
});
