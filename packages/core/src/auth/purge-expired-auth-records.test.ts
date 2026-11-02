import { randomUUID } from "node:crypto";
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
