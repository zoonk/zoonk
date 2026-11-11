import "server-only";
import { prisma } from "@zoonk/db";

/**
 * A rotated refresh token stays until it expires: presenting one again is how the OAuth provider
 * spots a stolen login. The two deletes run one after the other because deleting a refresh token
 * also deletes the access tokens issued with it.
 */
async function purgeExpiredOauthTokens(now: Date): Promise<number> {
  const accessTokens = await prisma.oauthAccessToken.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  const refreshTokens = await prisma.oauthRefreshToken.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  return accessTokens.count + refreshTokens.count;
}

export async function purgeExpiredAuthRecords(): Promise<{
  oauthRecordsPurged: number;
  recordsPurged: number;
  sessionsPurged: number;
}> {
  const now = new Date();

  const [sessions, recordsPurged, deviceCodes, oauthTokensPurged] = await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.$executeRaw`
      DELETE FROM access_records
      WHERE created_at < ${now}::timestamp - INTERVAL '6 months'
    `,
    prisma.deviceCode.deleteMany({ where: { expiresAt: { lt: now } } }),
    purgeExpiredOauthTokens(now),
  ]);

  return {
    oauthRecordsPurged: deviceCodes.count + oauthTokensPurged,
    recordsPurged,
    sessionsPurged: sessions.count,
  };
}
