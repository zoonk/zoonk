import { userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { signInAsCurrentUser } from "../../../test-utils/auth";
import { getEnergyLevel } from "./get-energy-level";

vi.mock("@/data/_utils/get-request-time-zone", () => ({
  getRequestProgressDateContext: () =>
    Promise.resolve({ currentDate: new Date("2026-07-12T00:00:00Z"), timeZone: "UTC" }),
}));

describe(getEnergyLevel, () => {
  it("returns null for an unauthenticated request", async () => {
    await expect(getEnergyLevel()).resolves.toBeNull();
  });

  it("loads the authenticated learner through the request and cache adapter", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await userProgressFixture({
      currentEnergy: 50,
      lastActiveAt: new Date("2026-07-07T12:00:00Z"),
      userId: user.id,
    });

    await expect(getEnergyLevel()).resolves.toStrictEqual({ currentEnergy: 46 });
  });
});
