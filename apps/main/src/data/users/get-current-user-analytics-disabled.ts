import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { cache } from "react";

/**
 * The root layout needs a server-side tracking decision before any analytics
 * component mounts, but Better Auth sessions do not expose custom Prisma user
 * columns, so the flag is read from the user row directly.
 */
export const getCurrentUserAnalyticsDisabled = cache(async () => {
  const session = await getSession();

  if (!session) {
    return false;
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });

  return user?.analyticsDisabled ?? false;
});
