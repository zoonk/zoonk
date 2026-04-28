import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { cache } from "react";

/**
 * Returns the total brain power accumulated by the current user.
 *
 * Used at player page load to pass to the player, which computes
 * completion metrics (belt level, BP to next level) client-side for
 * instant display without waiting for a server round-trip.
 */
export const getTotalBrainPower = cache(async (headers?: Headers): Promise<number> => {
  const session = await getSession(headers);

  if (!session) {
    return 0;
  }

  const progress = await prisma.userProgress.findUnique({
    select: { totalBrainPower: true },
    where: { userId: session.user.id },
  });

  return Number(progress?.totalBrainPower ?? 0);
});
