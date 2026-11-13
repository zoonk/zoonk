import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { CLI_CLIENT_ID } from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";

const MAX_LOGINS = 200;

/**
 * Each machine's login is its one refresh token that hasn't renewed or been revoked. Revoking ends
 * a person's logins together, so they're listed by person. Expired ones stay until the daily purge,
 * at most a day. One ends by itself after 30 days without use.
 */
export const listCliLoginsByPerson = cacheAdminData(async () => {
  const logins = await prisma.oauthRefreshToken.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: { createdAt: true, user: { select: { email: true, id: true, name: true } } },
    take: MAX_LOGINS,
    where: { clientId: CLI_CLIENT_ID, revoked: null },
  });

  return [...Map.groupBy(logins, (login) => login.user.id).values()].flatMap(([latest, ...older]) =>
    latest
      ? [
          // A login renews itself while it's used, so the newest token's date is its last use.
          { lastUsedAt: latest.createdAt, machines: older.length + 1, user: latest.user },
        ]
      : [],
  );
});
