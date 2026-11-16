import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getWeeklyRecap } from "./get-weekly-recap";

const MONDAY = new Date("2026-10-12T00:00:00Z");

describe(getWeeklyRecap, () => {
  afterEach(() => vi.useRealTimers());

  it("never assigns planned study to a learner without a goal, and keeps their studied day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
    const user = await userFixture();
    mockSession(user.id);

    await dailyProgressFixtureMany([{ date: MONDAY, timeSpentSeconds: 600, userId: user.id }]);
    const result = await getWeeklyRecap({ timeZone: "UTC", weekStart: "2026-10-12" });
    expect(result.status).toBe("ready");

    if (result.status !== "ready") {
      throw new Error(result.status);
    }

    expect(result.recap.days[0]).toMatchObject({
      date: MONDAY,
      goalMinutes: 0,
      minutes: 10,
      studied: true,
    });

    expect(result.recap.days.every((day) => day.goalMinutes === 0 && day.kind === "rest")).toBe(
      true,
    );
  });
});
