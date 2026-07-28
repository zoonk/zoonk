import { userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getEnergyLevel } from "./get-energy-level";
import { getRequestProgressDateContext } from "./get-request-date-context";

const CURRENT_DATE = new Date("2026-07-12T00:00:00Z");

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

describe(getEnergyLevel, () => {
  it("returns null for an unauthenticated request", async () => {
    mockSession(null);
    mockCurrentDate();

    await expect(getEnergyLevel()).resolves.toBeNull();
  });

  it("loads the authenticated learner without accepting a caller-selected user id", async () => {
    const user = await userFixture();
    mockSession(user.id);
    mockCurrentDate();

    await userProgressFixture({
      currentEnergy: 50,
      lastActiveAt: new Date("2026-07-07T12:00:00Z"),
      userId: user.id,
    });

    await expect(getEnergyLevel()).resolves.toStrictEqual({ currentEnergy: 46 });
  });
});
