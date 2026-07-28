import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession, mockSessionFailure } from "../_test-utils/mock-session";
import { getEnergyData } from "./get-energy-data";
import { getRequestProgressDateContext } from "./get-request-date-context";

const CURRENT_DATE = new Date("2026-01-10T00:00:00Z");

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("./get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

/** Fixes the learner-local clock used by the private Energy capability. */
function mockCurrentDate() {
  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: CURRENT_DATE,
    currentInstant: CURRENT_DATE,
    timeZone: "UTC",
  });
}

describe(getEnergyData, () => {
  it("propagates identity-provider failures", async () => {
    const error = new Error("Session lookup failed");
    mockSessionFailure(error);
    mockCurrentDate();

    await expect(getEnergyData()).rejects.toBe(error);
  });

  it("returns null for an unauthenticated request", async () => {
    mockSession(null);
    mockCurrentDate();

    await expect(getEnergyData()).resolves.toBeNull();
  });

  it("loads the authenticated learner without accepting a caller-selected user id", async () => {
    const user = await userFixture();
    mockSession(user.id);
    mockCurrentDate();

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
