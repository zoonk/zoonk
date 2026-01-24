import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export type EnergyLevelData = {
  currentEnergy: number;
};

export const getEnergyLevel = cache(async (headers?: Headers): Promise<EnergyLevelData | null> => {
  const session = await getSession(headers);

  if (!session) {
    return null;
  }

  const userId = Number(session.user.id);

  const { data: progress, error } = await safeAsync(() =>
    prisma.userProgress.findUnique({
      select: { currentEnergy: true },
      where: { userId },
    }),
  );

  if (error || !progress) {
    return null;
  }

  return {
    currentEnergy: progress.currentEnergy,
  };
});
