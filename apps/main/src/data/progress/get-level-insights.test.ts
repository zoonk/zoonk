import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { getLevelInsights } from "./get-level-insights";

describe("unauthenticated users", () => {
  it("returns null", async () => {
    const result = await getLevelInsights({ headers: new Headers() });
    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  it("returns null when user has no DailyProgress records", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await getLevelInsights({ headers });
    expect(result).toBeNull();
  });

  it("returns the most recent highest BP day and learning days for the period", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    await prisma.dailyProgress.createMany({
      data: [
        {
          brainPowerEarned: 40,
          date: new Date("2025-01-05T00:00:00Z"),
          dayOfWeek: 0,
          staticCompleted: 1,
          userId: user.id,
        },
        {
          brainPowerEarned: 75,
          date: new Date("2025-01-06T00:00:00Z"),
          dayOfWeek: 1,
          interactiveCompleted: 1,
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
          userId: user.id,
        },
      ],
    });

    const result = await getLevelInsights({
      endDate: new Date("2025-01-31T23:59:59.999Z"),
      headers,
      startDate: new Date("2025-01-01T00:00:00Z"),
    });

    expect(result).not.toBeNull();

    expect(result?.highestBpDay).toStrictEqual({
      brainPower: 75,
      date: new Date("2025-01-10T00:00:00Z"),
    });

    expect(result?.learningDays).toBe(3);
  });
});
