import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";

export type EnergyInsightsData = { averageEnergy: number; fullEnergyDays: number };

/**
 * Returning null only when no Energy rows exist keeps a zero full-energy count
 * visible for learners whose lifetime average is still meaningful.
 */
function buildEnergyInsights({
  averageEnergy,
  fullEnergyDays,
}: {
  averageEnergy: number | null;
  fullEnergyDays: number;
}): EnergyInsightsData | null {
  return averageEnergy === null ? null : { averageEnergy, fullEnergyDays };
}

/**
 * The two cards are lifetime summaries, so neither query applies the default
 * progress lookback or any chart-window boundary.
 */
async function findEnergyInsights(userId: string): Promise<EnergyInsightsData | null> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const [energyAggregate, fullEnergyDays] = await Promise.all([
    prisma.dailyProgress.aggregate({ _avg: { energyAtEnd: true }, where: { userId } }),
    prisma.dailyProgress.count({ where: { energyAtEnd: { gte: 100 }, userId } }),
  ]);

  return buildEnergyInsights({ averageEnergy: energyAggregate._avg.energyAtEnd, fullEnergyDays });
}

/** Returns the signed-in learner's lifetime Energy summary cards. */
export async function getEnergyInsights(): Promise<EnergyInsightsData | null> {
  const session = await getSession();
  return session ? findEnergyInsights(session.user.id) : null;
}
