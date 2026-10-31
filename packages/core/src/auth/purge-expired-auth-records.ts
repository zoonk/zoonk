import "server-only";
import { prisma } from "@zoonk/db";

export async function purgeExpiredAuthRecords(): Promise<{
  recordsPurged: number;
  sessionsPurged: number;
}> {
  const now = new Date();

  const [sessions, recordsPurged] = await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.$executeRaw`
      DELETE FROM access_records
      WHERE created_at < ${now}::timestamp - INTERVAL '6 months'
    `,
  ]);

  return { recordsPurged, sessionsPurged: sessions.count };
}
