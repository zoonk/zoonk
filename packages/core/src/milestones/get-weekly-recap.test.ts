import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
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
      hitGoal: true,
      minutes: 10,
      studied: true,
    });

    expect(result.recap.days.every((day) => day.goalMinutes === 0 && day.kind === "rest")).toBe(
      true,
    );
  });

  it("returns the same goal's studied dates to every client, including a session finished without recorded time", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const goal = await goalFixture({ createdAt: MONDAY, timezone: "UTC", userId: user.id });
    const other = await goalFixture({ userId: user.id });
    const tuesday = new Date("2026-10-13T00:00:00Z");
    const wednesday = new Date("2026-10-14T00:00:00Z");
    await planFixture({ goalId: goal.id });

    await Promise.all([
      learningEventFixture({ goalId: other.id, localDate: tuesday, seconds: 900, userId: user.id }),
      dailyProgressFixtureMany([{ date: tuesday, timeSpentSeconds: 900, userId: user.id }]),
    ]);

    const empty = await getWeeklyRecap({ goalId: goal.id, weekStart: "2026-10-12" });
    expect(empty).toMatchObject({ recap: { week: { daysStudied: [] } }, status: "ready" });

    await Promise.all([
      learningEventFixture({ goalId: goal.id, localDate: MONDAY, seconds: 30, userId: user.id }),
      studySessionFixture({
        endedAt: new Date("2026-10-14T12:00:00Z"),
        goalId: goal.id,
        localDate: wednesday,
        userId: user.id,
      }),
    ]);

    const result = await getWeeklyRecap({ goalId: goal.id, weekStart: "2026-10-12" });

    if (result.status !== "ready") {
      throw new Error(result.status);
    }

    expect(result.recap.week.daysStudied).toStrictEqual([MONDAY, wednesday]);

    expect(result.recap.week.daysStudied).toStrictEqual(
      result.recap.days.filter((day) => day.studied).map((day) => day.date),
    );
  });
});
