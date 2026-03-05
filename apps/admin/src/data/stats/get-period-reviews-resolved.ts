import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getPeriodReviewsResolved = cache(async (start: Date, end: Date) =>
  prisma.contentReview.count({
    where: { reviewedAt: { gte: start, lte: end } },
  }),
);
