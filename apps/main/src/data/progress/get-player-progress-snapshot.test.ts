import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { getPlayerProgressSnapshot } from "./get-player-progress-snapshot";

describe("unauthenticated users", () => {
  it("returns null", async () => {
    const result = await getPlayerProgressSnapshot({ headers: new Headers() });

    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  it("returns a zero snapshot when the user has no progress yet", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await getPlayerProgressSnapshot({
      headers,
      now: new Date("2026-01-10T12:00:00Z"),
    });

    expect(result).toStrictEqual({
      currentEnergy: 0,
      fullEnergyDays: 0,
      highestPreviousDailyBrainPower: 0,
      todayBrainPower: 0,
      todayEnergyAtEnd: null,
    });
  });

  it("returns decayed energy, today progress, previous daily BP record, and full-energy days", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    await Promise.all([
      prisma.userProgress.create({
        data: {
          currentEnergy: 50,
          lastActiveAt: new Date("2026-01-08T00:00:00Z"),
          totalBrainPower: 120n,
          userId: user.id,
        },
      }),
      prisma.dailyProgress.createMany({
        data: [
          {
            brainPowerEarned: 60,
            date: new Date("2026-01-05T00:00:00Z"),
            dayOfWeek: 1,
            energyAtEnd: 100,
            interactiveCompleted: 1,
            userId: user.id,
          },
          {
            brainPowerEarned: 80,
            date: new Date("2026-01-09T00:00:00Z"),
            dayOfWeek: 5,
            energyAtEnd: 100,
            interactiveCompleted: 1,
            userId: user.id,
          },
          {
            brainPowerEarned: 40,
            date: new Date("2026-01-10T00:00:00Z"),
            dayOfWeek: 6,
            energyAtEnd: 99,
            interactiveCompleted: 1,
            userId: user.id,
          },
        ],
      }),
    ]);

    const result = await getPlayerProgressSnapshot({
      headers,
      now: new Date("2026-01-10T12:00:00Z"),
    });

    expect(result).toStrictEqual({
      currentEnergy: 49,
      fullEnergyDays: 2,
      highestPreviousDailyBrainPower: 80,
      todayBrainPower: 40,
      todayEnergyAtEnd: 99,
    });
  });
});
