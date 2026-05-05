import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const countUsers = cache(() => prisma.user.count());
