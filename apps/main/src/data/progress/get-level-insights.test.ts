import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { signInAsCurrentUser } from "../../../test-utils/auth";
import { getLevelInsights } from "./get-level-insights";

describe("unauthenticated users", () => {
  it("returns null", async () => {
    const result = await getLevelInsights();
    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  it("returns null when user has no DailyProgress records", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    const result = await getLevelInsights();
    expect(result).toBeNull();
  });

  it("returns the most recent highest BP day for the period", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await prisma.dailyProgress.createMany({
      data: [
        {
          brainPowerEarned: 40,
          date: new Date("2025-01-05T00:00:00Z"),
          dayOfWeek: 0,
          staticCompleted: 1,
          timeSpentSeconds: 60,
          userId: user.id,
        },
        {
          brainPowerEarned: 75,
          date: new Date("2025-01-06T00:00:00Z"),
          dayOfWeek: 1,
          interactiveCompleted: 1,
          timeSpentSeconds: 120,
          userId: user.id,
        },
        {
          brainPowerEarned: 75,
          date: new Date("2025-01-10T00:00:00Z"),
          dayOfWeek: 5,
          staticCompleted: 1,
          userId: user.id,
        },
        {
          brainPowerEarned: 100,
          date: new Date("2025-02-01T00:00:00Z"),
          dayOfWeek: 6,
          interactiveCompleted: 1,
          timeSpentSeconds: 600,
          userId: user.id,
        },
      ],
    });

    const result = await getLevelInsights({
      endDate: new Date("2025-01-31T23:59:59.999Z"),
      startDate: new Date("2025-01-01T00:00:00Z"),
    });

    expect(result).toStrictEqual({
      highestBpDay: { brainPower: 75, date: new Date("2025-01-10T00:00:00Z") },
    });
  });

  it("returns null when the period has no Brain Power", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await prisma.dailyProgress.create({
      data: {
        date: new Date("2025-01-05T00:00:00Z"),
        dayOfWeek: 0,
        staticCompleted: 1,
        timeSpentSeconds: 60,
        userId: user.id,
      },
    });

    const result = await getLevelInsights({
      endDate: new Date("2025-01-31T23:59:59.999Z"),
      startDate: new Date("2025-01-01T00:00:00Z"),
    });

    expect(result).toBeNull();
  });
});
