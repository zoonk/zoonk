import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { countPendingReviews } from "@/data/review/count-pending-reviews";

export const countTotalPendingReviews = cacheAdminData(async () => {
  const counts = await countPendingReviews();
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
});
