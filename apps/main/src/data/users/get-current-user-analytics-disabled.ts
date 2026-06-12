import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { cache } from "react";

/**
 * The analytics leaf needs the persisted tracking decision and user id, but
 * Better Auth sessions do not expose the custom analytics flag, so the user
 * row stays the source of truth.
 */
export const getCurrentUserAnalyticsState = cache(async () => {
  const session = await getSession();

  if (!session) {
    return { analyticsDisabled: false, userId: null };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });

  if (!user) {
    return { analyticsDisabled: false, userId: null };
  }

  return { analyticsDisabled: user.analyticsDisabled, userId: user.id };
});

/**
 * Preserves the existing boolean helper for call sites that only need to know
 * whether the current user should be excluded from analytics.
 */
export const getCurrentUserAnalyticsDisabled = cache(async () => {
  const { analyticsDisabled } = await getCurrentUserAnalyticsState();
  return analyticsDisabled;
});
