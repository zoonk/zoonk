import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { type BeltLevelResult, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export const getBeltLevel = cache(async (headers?: Headers): Promise<BeltLevelResult | null> => {
  const session = await getSession(headers);

  if (!session) {
    return null;
  }

  const userId = Number(session.user.id);

  const { data: progress, error } = await safeAsync(() =>
    prisma.userProgress.findUnique({
      where: { userId },
    }),
  );

  if (error || !progress) {
    return null;
  }

  return calculateBeltLevel(Number(progress.totalBrainPower));
});
