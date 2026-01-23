import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { calculateBeltLevel } from "@zoonk/utils/belt-level";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import type { BeltLevelResult } from "@zoonk/utils/belt-level";

export type BeltLevelData = BeltLevelResult;

export const getBeltLevel = cache(
  async (params?: { headers?: Headers }): Promise<BeltLevelData | null> => {
    const session = await getSession({ headers: params?.headers });

    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);

    const { data: progress, error } = await safeAsync(() =>
      prisma.userProgress.findUnique({
        select: { totalBrainPower: true },
        where: { userId },
      }),
    );

    if (error || !progress) {
      return null;
    }

    return calculateBeltLevel(Number(progress.totalBrainPower));
  },
);
