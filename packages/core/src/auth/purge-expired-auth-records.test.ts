import { randomUUID } from "node:crypto";
import { CLI_CLIENT_ID, STAFF_READ_SCOPE } from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { purgeExpiredAuthRecords } from "./purge-expired-auth-records";

describe(purgeExpiredAuthRecords, () => {
  afterEach(() => vi.useRealTimers());

  it("deletes expired sessions and preserves sessions expiring at or after now", async () => {
    const now = new Date("2020-08-31T12:00:00Z");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);

    const user = await prisma.user.create({
      data: { email: `${randomUUID()}@example.test`, name: "Retention" },
    });

    const sessions = await Promise.all(
      [-1, 0, 1].map((offset) =>
        prisma.session.create({
          data: {
            expiresAt: new Date(now.getTime() + offset),
            token: randomUUID(),
            userId: user.id,
          },
        }),
      ),
    );

    await purgeExpiredAuthRecords();

    await expect(
      prisma.session.findMany({ orderBy: { expiresAt: "asc" }, where: { userId: user.id } }),
    ).resolves.toStrictEqual(sessions.slice(1));
  });

  it("deletes expired CLI tokens and device codes, keeping rotated tokens until they expire", async () => {
    const now = new Date("2020-08-31T12:00:00Z");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);

    const user = await prisma.user.create({
      data: { email: `${randomUUID()}@example.test`, name: "Retention" },
    });

    const tokenAt = (offset: number) => ({
      clientId: CLI_CLIENT_ID,
      expiresAt: new Date(now.getTime() + offset),
      scopes: [STAFF_READ_SCOPE],
      token: randomUUID(),
      userId: user.id,
    });

    const [, rotated, live] = await Promise.all([
      prisma.oauthRefreshToken.create({ data: tokenAt(-1) }),
      prisma.oauthRefreshToken.create({ data: { ...tokenAt(0), revoked: now, rotatedAt: now } }),
      prisma.oauthRefreshToken.create({ data: tokenAt(1) }),
    ]);

    const [, liveAccess] = await Promise.all([
      prisma.oauthAccessToken.create({ data: { ...tokenAt(-1), refreshId: live.id } }),
      prisma.oauthAccessToken.create({ data: { ...tokenAt(0), refreshId: live.id } }),
    ]);

    const deviceCodes = await Promise.all(
      [-1, 0].map((offset) =>
        prisma.deviceCode.create({
          data: {
            deviceCode: randomUUID(),
            expiresAt: new Date(now.getTime() + offset),
            status: "pending",
            userCode: randomUUID(),
          },
        }),
      ),
    );

    await purgeExpiredAuthRecords();

    const [refreshTokens, accessTokens, remainingCodes] = await Promise.all([
      prisma.oauthRefreshToken.findMany({
        orderBy: { expiresAt: "asc" },
        where: { userId: user.id },
      }),
      prisma.oauthAccessToken.findMany({ where: { userId: user.id } }),
      prisma.deviceCode.findMany({ where: { id: { in: deviceCodes.map((code) => code.id) } } }),
    ]);

    expect(refreshTokens.map((token) => token.id)).toStrictEqual([rotated.id, live.id]);
    expect(accessTokens.map((token) => token.id)).toStrictEqual([liveAccess.id]);
    expect(remainingCodes.map((code) => code.id)).toStrictEqual([deviceCodes[1]?.id]);
  });

  it("retains six calendar months including the exact boundary at a short month end", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2020-08-31T12:00:00Z"));
    const userId = randomUUID();
    const boundary = new Date("2020-02-29T12:00:00Z");

    const records = await Promise.all(
      [-1, 0, 1].map((offset) =>
        prisma.accessRecord.create({
          data: {
            createdAt: new Date(boundary.getTime() + offset),
            id: randomUUID(),
            ipAddress: "203.0.113.1",
            userId,
          },
        }),
      ),
    );

    await purgeExpiredAuthRecords();

    await expect(
      prisma.accessRecord.findMany({ orderBy: { createdAt: "asc" }, where: { userId } }),
    ).resolves.toStrictEqual(records.slice(1));
  });
});
