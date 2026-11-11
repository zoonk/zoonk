import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { CLI_CLIENT_ID } from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";

const MAX_LOGINS = 200;

/**
 * Each machine's login is its one refresh token that hasn't renewed or been revoked. Revoking ends
 * a person's logins together, so they're listed by person. Expired ones stay until the daily purge,
 * at most a day.
 */
export const listCliLoginsByPerson = cacheAdminData(async () => {
  const logins = await prisma.oauthRefreshToken.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      createdAt: true,
      expiresAt: true,
      user: { select: { email: true, id: true, name: true } },
    },
    take: MAX_LOGINS,
    where: { clientId: CLI_CLIENT_ID, revoked: null },
  });

  return [...Map.groupBy(logins, (login) => login.user.id).values()].flatMap(([latest, ...older]) =>
    latest
      ? [
          {
            endsAt: new Date(
              Math.max(...[latest, ...older].map((login) => login.expiresAt.getTime())),
            ),
            lastRenewedAt: latest.createdAt,
            machines: older.length + 1,
            user: latest.user,
          },
        ]
      : [],
  );
});
