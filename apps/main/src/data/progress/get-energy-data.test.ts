import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { signInAsCurrentUser } from "../../../test-utils/auth";
import { getEnergyData } from "./get-energy-data";

vi.mock("@/data/_utils/get-request-time-zone", () => ({
  getRequestProgressDateContext: () =>
    Promise.resolve({ currentDate: new Date("2026-01-10T00:00:00Z"), timeZone: "UTC" }),
}));

describe(getEnergyData, () => {
  it("returns null for an unauthenticated request", async () => {
    await expect(getEnergyData()).resolves.toBeNull();
  });

  it("loads the authenticated learner through the request and cache adapter", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await Promise.all([
      userProgressFixture({
        currentEnergy: 50,
        lastActiveAt: new Date("2026-01-10T12:00:00Z"),
        userId: user.id,
      }),
      dailyProgressFixtureMany([
        { date: new Date("2026-01-10T00:00:00Z"), energyAtEnd: 50, userId: user.id },
      ]),
    ]);

    const result = await getEnergyData();

    expect(result?.currentEnergy).toBe(50);

    expect(result?.days.at(-1)).toStrictEqual({
      date: new Date("2026-01-10T00:00:00Z"),
      energy: 50,
    });
  });
});
