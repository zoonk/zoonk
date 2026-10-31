import { prisma } from "@zoonk/db";
import { userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { beforeEach, describe, expect, it } from "vitest";
import { mockGuestSession, mockSession, mockSessionFailure } from "../../_test-utils/mock-session";
import { getUserProgress } from "../../progress/get-user-progress";
import { getUserProgress as queryUserProgress } from "../../progress/progress-metrics";
import { measureProgress } from "../../sessions/_utils/capture-snapshot";
import { readUserProgress } from "./user-progress";

const INSTANT = new Date("2026-07-12T12:00:00Z");

describe("persisted user progress request fact", () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("returns the complete stored row only for the derived actor", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);

    const row = await userProgressFixture({
      currentEnergy: 60,
      lastActiveAt: INSTANT,
      totalBrainPower: 4321n,
      userId: owner.id,
    });

    const fact = await countDatabaseStatements(() => readUserProgress(owner.id));

    expect(fact).toStrictEqual({ result: row, statements: 1, writes: 0 });
    await expect(readUserProgress(other.id)).resolves.toBeNull();
    mockSession(owner.id);
    await expect(getUserProgress()).resolves.toStrictEqual(row);
    mockSession(other.id);
    await expect(getUserProgress()).resolves.toBeNull();
  });

  it("keeps a persisted zero placeholder distinct from a missing row", async () => {
    const user = await userFixture();

    const row = await userProgressFixture({
      currentEnergy: 0,
      lastActiveAt: INSTANT,
      totalBrainPower: 0n,
      userId: user.id,
    });

    mockSession(user.id);
    await expect(readUserProgress(user.id)).resolves.toStrictEqual(row);
    await expect(getUserProgress()).resolves.toStrictEqual(row);
  });

  it("keeps visitors query-free, lets a guest read their row, and propagates auth failures", async () => {
    const visitor = await countDatabaseStatements(getUserProgress);

    expect(visitor).toStrictEqual({ result: null, statements: 0, writes: 0 });
    const guest = await userFixture();
    const row = await userProgressFixture({ totalBrainPower: 10n, userId: guest.id });
    mockGuestSession(guest.id);
    await expect(getUserProgress()).resolves.toStrictEqual(row);
    const error = new Error("session unavailable");
    mockSessionFailure(error);
    await expect(getUserProgress()).rejects.toBe(error);
  });

  it.each(["row", "promise", "null", "null promise"] as const)(
    "measures a supplied %s without re-reading progress",
    async (kind) => {
      const user = await userFixture();

      await userProgressFixture({
        currentEnergy: 60,
        lastActiveAt: INSTANT,
        totalBrainPower: 1000n,
        userId: user.id,
      });

      const fact = await readUserProgress(user.id);

      await prisma.userProgress.update({
        data: { currentEnergy: 90, totalBrainPower: 3000n },
        where: { userId: user.id },
      });

      const supplied = kind === "null" || kind === "null promise" ? null : fact;

      const progress =
        kind === "promise" || kind === "null promise" ? Promise.resolve(supplied) : supplied;

      const measured = await countDatabaseStatements(() =>
        measureProgress({ now: INSTANT, progress, timeZone: "UTC", userId: user.id }),
      );

      expect(measured).toStrictEqual({
        result: supplied ? { brainPower: 1000, energy: 60 } : { brainPower: 0, energy: 0 },
        statements: 0,
        writes: 0,
      });
    },
  );

  it("keeps the existing metrics and snapshot default fresh after a GET snapshot", async () => {
    const user = await userFixture();

    await userProgressFixture({
      currentEnergy: 60,
      lastActiveAt: INSTANT,
      totalBrainPower: 1000n,
      userId: user.id,
    });

    const display = await readUserProgress(user.id);

    await prisma.userProgress.update({
      data: { currentEnergy: 80, totalBrainPower: 2000n },
      where: { userId: user.id },
    });

    const metrics = await countDatabaseStatements(() => queryUserProgress({ userId: user.id }));

    expect(display).toMatchObject({ currentEnergy: 60, totalBrainPower: 1000n });

    expect(metrics).toMatchObject({
      result: { currentEnergy: 80, totalBrainPower: 2000n },
      statements: 1,
      writes: 0,
    });

    await prisma.userProgress.update({
      data: { currentEnergy: 90, totalBrainPower: 3000n },
      where: { userId: user.id },
    });

    const snapshot = await countDatabaseStatements(() =>
      measureProgress({ now: INSTANT, timeZone: "UTC", userId: user.id }),
    );

    expect(snapshot).toMatchObject({
      result: { brainPower: 3000, energy: 90 },
      statements: 1,
      writes: 0,
    });

    await prisma.userProgress.update({
      data: { currentEnergy: 95, totalBrainPower: 4000n },
      where: { userId: user.id },
    });

    const explicitDefault = await countDatabaseStatements(() =>
      measureProgress({ now: INSTANT, progress: undefined, timeZone: "UTC", userId: user.id }),
    );

    expect(explicitDefault).toStrictEqual({
      result: { brainPower: 4000, energy: 95 },
      statements: 1,
      writes: 0,
    });
  });
});
