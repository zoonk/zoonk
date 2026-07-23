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

  it("returns all-time average Energy and full-energy days for only the learner", async () => {
    const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await prisma.dailyProgress.createMany({
      data: [
        { date: new Date("2020-01-05T00:00:00Z"), dayOfWeek: 0, energyAtEnd: 100, userId: user.id },
        { date: new Date("2025-01-10T00:00:00Z"), dayOfWeek: 5, energyAtEnd: 50, userId: user.id },
        {
          date: new Date("2025-01-10T00:00:00Z"),
          dayOfWeek: 5,
          energyAtEnd: 100,
          userId: otherUser.id,
        },
      ],
    });

    const result = await getEnergyInsights();

    expect(result).toStrictEqual({ averageEnergy: 75, fullEnergyDays: 1 });
  });
});
