import "server-only";
import { countPendingReviews } from "@/data/review/count-pending-reviews";
import { cache } from "react";

export const countTotalPendingReviews = cache(async () => {
  const counts = await countPendingReviews();
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
});
