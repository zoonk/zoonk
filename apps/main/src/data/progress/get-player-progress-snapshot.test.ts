import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signInAsCurrentUser } from "../../../test-utils/auth";
import { getPlayerProgressSnapshot } from "./get-player-progress-snapshot";

describe("unauthenticated users", () => {
  it("returns null", async () => {
    const result = await getPlayerProgressSnapshot();

    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when an optional progress query fails", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });
    const queryError = new Error("Progress query failed");
    vi.spyOn(prisma.userProgress, "findUnique").mockRejectedValueOnce(queryError);

    const result = await getPlayerProgressSnapshot({ now: new Date("2026-01-10T12:00:00Z") });

    expect(result).toBeNull();
  });

  it("returns a zero snapshot when the user has no progress yet", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    const result = await getPlayerProgressSnapshot({ now: new Date("2026-01-10T12:00:00Z") });

    expect(result).toStrictEqual({
      bestDayScores: [],
      currentEnergy: 0,
      fullEnergyDays: 0,
      highestPreviousDailyBrainPower: 0,
      learningDays: 0,
      todayBrainPower: 0,
      todayCompletedLessons: 0,
      todayEnergyAtEnd: null,
      todayInteractiveLessons: 0,
      totalBrainPower: 0,
      totalLearningSeconds: 0,
    });
  });

  it("returns decayed energy, today progress, previous daily BP record, and full-energy days", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

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
            date: new Date("2026-01-10T00:00:00Z"),
            dayOfWeek: 6,
            energyAtEnd: 99,
            incorrectAnswers: 1,
            interactiveCompleted: 1,
            timeSpentSeconds: 120,
            userId: user.id,
          },
        ],
      }),
    ]);

    const result = await getPlayerProgressSnapshot({ now: new Date("2026-01-10T12:00:00Z") });

    expect(result).toStrictEqual({
      bestDayScores: [
        { correctAnswers: 18, dayOfWeek: 1, incorrectAnswers: 2 },
        { correctAnswers: 8, dayOfWeek: 5, incorrectAnswers: 2 },
        { correctAnswers: 4, dayOfWeek: 6, incorrectAnswers: 1 },
      ],
      currentEnergy: 49,
      fullEnergyDays: 2,
      highestPreviousDailyBrainPower: 80,
      learningDays: 3,
      todayBrainPower: 40,
      todayCompletedLessons: 1,
      todayEnergyAtEnd: 99,
      todayInteractiveLessons: 1,
      totalBrainPower: 120,
      totalLearningSeconds: 1020,
    });
  });
});
