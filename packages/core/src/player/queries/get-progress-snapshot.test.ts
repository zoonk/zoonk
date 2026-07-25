import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { getPlayerProgressSnapshot } from "./get-progress-snapshot";

const TODAY = new Date("2026-01-10T00:00:00Z");
const BEST_DAY_RANGE = { endDate: TODAY, startDate: new Date("2025-10-13T00:00:00Z") };

describe(getPlayerProgressSnapshot, () => {
  it("returns a zero snapshot when the learner has no progress yet", async () => {
    const user = await userFixture();

    await expect(
      getPlayerProgressSnapshot({
        bestDayRange: BEST_DAY_RANGE,
        timeZone: "UTC",
        today: TODAY,
        userId: user.id,
      }),
    ).resolves.toStrictEqual({
      progressSnapshot: {
        bestDayScores: [],
        currentEnergy: 0,
        fullEnergyDays: 0,
        highestPreviousDailyBrainPower: 0,
        learningDays: 0,
        todayBrainPower: 0,
        todayCompletedLessons: 0,
        todayEnergyAtEnd: null,
        todayInteractiveLessons: 0,
        totalLearningSeconds: 0,
      },
      totalBrainPower: 0,
    });
  });

  it("assembles milestone facts from the learner's complete progress history", async () => {
    const user = await userFixture();

    await prisma.userProgress.create({
      data: {
        currentEnergy: 99,
        lastActiveAt: new Date("2026-01-10T12:00:00Z"),
        totalBrainPower: 123n,
        userId: user.id,
      },
    });

    await prisma.dailyProgress.createMany({
      data: [
        {
          brainPowerEarned: 60,
          correctAnswers: 18,
          date: new Date("2026-01-05T00:00:00Z"),
          dayOfWeek: 1,
          energyAtEnd: 100,
          incorrectAnswers: 2,
          interactiveCompleted: 1,
          timeSpentSeconds: 300,
          userId: user.id,
        },
        {
          brainPowerEarned: 80,
          correctAnswers: 8,
          date: new Date("2026-01-09T00:00:00Z"),
          dayOfWeek: 5,
          energyAtEnd: 100,
          incorrectAnswers: 2,
          interactiveCompleted: 1,
          timeSpentSeconds: 600,
          userId: user.id,
        },
        {
          brainPowerEarned: 40,
          correctAnswers: 4,
          date: TODAY,
          dayOfWeek: 6,
          energyAtEnd: 99,
          incorrectAnswers: 1,
          interactiveCompleted: 1,
          timeSpentSeconds: 120,
          userId: user.id,
        },
      ],
    });

    await expect(
      getPlayerProgressSnapshot({
        bestDayRange: BEST_DAY_RANGE,
        timeZone: "UTC",
        today: TODAY,
        userId: user.id,
      }),
    ).resolves.toStrictEqual({
      progressSnapshot: {
        bestDayScores: [
          { correctAnswers: 18, dayOfWeek: 1, incorrectAnswers: 2 },
          { correctAnswers: 8, dayOfWeek: 5, incorrectAnswers: 2 },
          { correctAnswers: 4, dayOfWeek: 6, incorrectAnswers: 1 },
        ],
        currentEnergy: 99,
        fullEnergyDays: 2,
        highestPreviousDailyBrainPower: 80,
        learningDays: 3,
        todayBrainPower: 40,
        todayCompletedLessons: 1,
        todayEnergyAtEnd: 99,
        todayInteractiveLessons: 1,
        totalLearningSeconds: 1020,
      },
      totalBrainPower: 123,
    });
  });

  it("derives current Energy from the newest sparse completion cursor", async () => {
    const user = await userFixture();

    await Promise.all([
      prisma.userProgress.create({
        data: {
          currentEnergy: 50,
          lastActiveAt: new Date("2026-01-07T12:00:00Z"),
          userId: user.id,
        },
      }),
      prisma.dailyProgress.create({
        data: {
          date: new Date("2026-01-07T00:00:00Z"),
          dayOfWeek: 3,
          energyAtEnd: 50,
          userId: user.id,
        },
      }),
    ]);

    const result = await getPlayerProgressSnapshot({
      bestDayRange: BEST_DAY_RANGE,
      timeZone: "UTC",
      today: TODAY,
      userId: user.id,
    });

    expect(result.progressSnapshot.currentEnergy).toBe(48);
  });
});
