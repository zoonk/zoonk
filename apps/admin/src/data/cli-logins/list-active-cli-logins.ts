import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

const MAX_LOGINS = 200;

/**
 * Each machine's login is its one refresh token that hasn't rotated or been revoked. Expired ones
 * stay until the daily purge, at most a day, and show their end date.
 */
export const listActiveCliLogins = cacheAdminData(async () =>
  prisma.oauthRefreshToken.findMany({
    include: {
      client: { select: { clientId: true, name: true } },
      user: { select: { email: true, id: true, name: true } },
    },
    omit: { rotationReplayResponse: true, token: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: MAX_LOGINS,
    where: { revoked: null },
  }),
);
