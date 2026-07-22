import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { signInAsCurrentUser } from "../../../test-utils/auth";
import { getEnergyInsights } from "./get-energy-insights";

describe("unauthenticated users", () => {
  it("returns null", async () => {
    const result = await getEnergyInsights();
    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  it("returns null when user has no DailyProgress records", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    const result = await getEnergyInsights();
    expect(result).toBeNull();
  });

  it("returns the most recent highest energy day and full energy days for the period", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await prisma.dailyProgress.createMany({
      data: [
        { date: new Date("2025-01-05T00:00:00Z"), dayOfWeek: 0, energyAtEnd: 100, userId: user.id },
        { date: new Date("2025-01-10T00:00:00Z"), dayOfWeek: 5, energyAtEnd: 88, userId: user.id },
        { date: new Date("2025-01-15T00:00:00Z"), dayOfWeek: 3, energyAtEnd: 100, userId: user.id },
        { date: new Date("2025-02-01T00:00:00Z"), dayOfWeek: 6, energyAtEnd: 100, userId: user.id },
      ],
    });

    const result = await getEnergyInsights({
      endDate: new Date("2025-01-31T23:59:59.999Z"),
      startDate: new Date("2025-01-01T00:00:00Z"),
    });

    expect(result).not.toBeNull();
    expect(result?.fullEnergyDays).toBe(2);

    expect(result?.highestEnergyDay).toStrictEqual({
      date: new Date("2025-01-15T00:00:00Z"),
      energy: 100,
    });
  });
});
