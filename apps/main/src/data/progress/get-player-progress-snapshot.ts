import "server-only";
import { hasUserLearningProgress } from "@zoonk/core/progress/user-progress";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { computeDecayedEnergy, toUTCMidnight } from "@zoonk/utils/energy";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

type PlayerProgressSnapshot = {
  currentEnergy: number;
  fullEnergyDays: number;
  highestPreviousDailyBrainPower: number;
  todayBrainPower: number;
  todayEnergyAtEnd: number | null;
};

/**
 * The player needs the current Energy value after decay, but new learners may
 * not have a UserProgress row yet. Returning zero keeps first completions able
 * to evaluate daily BP records without pretending the progress query failed.
 */
function getCurrentEnergy({
  now,
  progress,
}: {
  now: Date;
  progress: Awaited<ReturnType<typeof prisma.userProgress.findUnique>>;
}) {
  if (!hasUserLearningProgress(progress)) {
    return 0;
  }

  return computeDecayedEnergy(progress.currentEnergy, progress.lastActiveAt, now);
}

/**
 * Packages the few pre-completion facts needed to decide whether the next local
 * completion crosses an Energy, full-energy-day, or daily-BP milestone.
 */
function buildPlayerProgressSnapshot({
  fullEnergyDays,
  highestPreviousDailyProgress,
  now,
  progress,
  todayProgress,
}: {
  fullEnergyDays: number;
  highestPreviousDailyProgress: Awaited<ReturnType<typeof prisma.dailyProgress.findFirst>>;
  now: Date;
  progress: Awaited<ReturnType<typeof prisma.userProgress.findUnique>>;
  todayProgress: Awaited<ReturnType<typeof prisma.dailyProgress.findUnique>>;
}): PlayerProgressSnapshot {
  return {
    currentEnergy: getCurrentEnergy({ now, progress }),
    fullEnergyDays,
    highestPreviousDailyBrainPower: highestPreviousDailyProgress?.brainPowerEarned ?? 0,
    todayBrainPower: todayProgress?.brainPowerEarned ?? 0,
    todayEnergyAtEnd: todayProgress?.energyAtEnd ?? null,
  };
}

const cachedGetPlayerProgressSnapshot = cache(
  async (nowIso?: string, headers?: Headers): Promise<PlayerProgressSnapshot | null> => {
    const session = await getSession(headers);

    if (!session) {
      return null;
    }

    const now = nowIso ? new Date(nowIso) : new Date();
    const today = toUTCMidnight(now);
    const userId = session.user.id;

    const { data, error } = await safeAsync(() =>
      Promise.all([
        prisma.userProgress.findUnique({ where: { userId } }),
        prisma.dailyProgress.findUnique({ where: { userDate: { date: today, userId } } }),
        prisma.dailyProgress.findFirst({
          orderBy: [{ brainPowerEarned: "desc" }, { date: "desc" }],
          where: { brainPowerEarned: { gt: 0 }, date: { lt: today }, userId },
        }),
        prisma.dailyProgress.count({ where: { energyAtEnd: { gte: 100 }, userId } }),
      ]),
    );

    if (error) {
      return null;
    }

    const [progress, todayProgress, highestPreviousDailyProgress, fullEnergyDays] = data;

    return buildPlayerProgressSnapshot({
      fullEnergyDays,
      highestPreviousDailyProgress,
      now,
      progress,
      todayProgress,
    });
  },
);

/**
 * Returns the pre-completion progress snapshot used by the player milestone
 * system. The optional date keeps integration tests stable without exposing a
 * client-controlled date in production.
 */
export function getPlayerProgressSnapshot(params?: {
  headers?: Headers;
  now?: Date;
}): Promise<PlayerProgressSnapshot | null> {
  return cachedGetPlayerProgressSnapshot(params?.now?.toISOString(), params?.headers);
}
