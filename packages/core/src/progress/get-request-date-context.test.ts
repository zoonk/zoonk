import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getRequestProgressDateContext } from "./get-request-date-context";

describe(getRequestProgressDateContext, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-12T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dates progress in the active goal's stored zone, as Today does", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ timezone: "Pacific/Kiritimati", userId: user.id });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);

    await expect(getRequestProgressDateContext()).resolves.toStrictEqual({
      currentDate: new Date("2026-07-13T00:00:00Z"),
      currentInstant: new Date("2026-07-12T12:00:00Z"),
      timeZone: "Pacific/Kiritimati",
    });
  });

  it("falls back to UTC for a visitor without a session", async () => {
    mockSession(null);

    await expect(getRequestProgressDateContext()).resolves.toStrictEqual({
      currentDate: new Date("2026-07-12T00:00:00Z"),
      currentInstant: new Date("2026-07-12T12:00:00Z"),
      timeZone: "UTC",
    });
  });
});
