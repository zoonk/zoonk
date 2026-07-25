import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signInAsCurrentUser } from "../../../test-utils/auth";
import { getPlayerProgressSnapshot } from "./get-player-progress-snapshot";

describe(getPlayerProgressSnapshot, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for an unauthenticated request", async () => {
    await expect(getPlayerProgressSnapshot()).resolves.toBeNull();
  });

  it("returns null when optional progress data cannot be loaded", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    vi.spyOn(prisma.userProgress, "findUnique").mockRejectedValueOnce(
      new Error("Progress query failed"),
    );

    await expect(
      getPlayerProgressSnapshot({ now: new Date("2026-01-10T12:00:00Z") }),
    ).resolves.toBeNull();
  });

  it("passes the same 90 learner-local dates as Score into the core snapshot", async () => {
    const now = new Date("2026-07-23T12:30:00.000Z");
    const user = await userFixture();

    const requestHeaders = await signInAsCurrentUser({
      email: user.email,
      password: user.password,
    });

    requestHeaders.set("x-vercel-ip-timezone", "Pacific/Kiritimati");

    await prisma.dailyProgress.createMany({
      data: [
        {
          correctAnswers: 10,
          date: new Date("2026-04-25T00:00:00.000Z"),
          dayOfWeek: 6,
          userId: user.id,
        },
        {
          correctAnswers: 1,
          date: new Date("2026-04-26T00:00:00.000Z"),
          dayOfWeek: 0,
          userId: user.id,
        },
        {
          brainPowerEarned: 42,
          correctAnswers: 2,
          date: new Date("2026-07-24T00:00:00.000Z"),
          dayOfWeek: 5,
          energyAtEnd: 87,
          interactiveCompleted: 1,
          staticCompleted: 2,
          userId: user.id,
        },
        {
          date: new Date("2026-07-25T00:00:00.000Z"),
          dayOfWeek: 6,
          incorrectAnswers: 10,
          userId: user.id,
        },
      ],
    });

    const result = await getPlayerProgressSnapshot({ now });

    expect(result?.progressSnapshot.bestDayScores).toStrictEqual([
      { correctAnswers: 1, dayOfWeek: 0, incorrectAnswers: 0 },
      { correctAnswers: 2, dayOfWeek: 5, incorrectAnswers: 0 },
    ]);

    expect(result?.progressSnapshot).toMatchObject({
      todayBrainPower: 42,
      todayCompletedLessons: 3,
      todayEnergyAtEnd: 87,
      todayInteractiveLessons: 1,
    });
  });
});
