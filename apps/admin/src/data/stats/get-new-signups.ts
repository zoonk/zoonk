import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getNewSignups = cache(async (start: Date, end: Date) =>
  prisma.user.count({
    where: { createdAt: { gte: start, lte: end } },
  }),
);
