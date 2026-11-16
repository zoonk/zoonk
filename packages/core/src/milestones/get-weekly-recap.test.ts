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

  it("keeps both weeks, their averages and comparisons on the requested goal, while no-goal recaps keep account totals", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const [goal, other] = await Promise.all([
      goalFixture({
        createdAt: new Date("2026-10-01T00:00:00Z"),
        timezone: "UTC",
        userId: user.id,
      }),
      goalFixture({ userId: user.id }),
    ]);

    const previous = new Date("2026-10-07T00:00:00Z");
    const previousOther = new Date("2026-10-05T00:00:00Z");
    const dates = Array.from({ length: 5 }, (_, i) => new Date(MONDAY.getTime() + i * 86_400_000));

    await Promise.all([
      planFixture({ goalId: goal.id }),
      learningEventFixture({
        correctAnswers: 3,
        goalId: goal.id,
        incorrectAnswers: 2,
        localDate: MONDAY,
        seconds: 600,
        userId: user.id,
      }),
      learningEventFixture({
        correctAnswers: 500,
        goalId: goal.id,
        kind: "session",
        localDate: MONDAY,
        seconds: 600,
        userId: user.id,
      }),
      learningEventFixture({
        correctAnswers: 2,
        goalId: goal.id,
        localDate: previous,
        seconds: 300,
        userId: user.id,
      }),
      learningEventFixture({
        correctAnswers: 60,
        goalId: other.id,
        localDate: previousOther,
        seconds: 3600,
        userId: user.id,
      }),
      ...dates.map((date) =>
        learningEventFixture({
          correctAnswers: 60,
          goalId: other.id,
          localDate: date,
          seconds: 3600,
          userId: user.id,
        }),
      ),
      dailyProgressFixtureMany([
        ...dates.map((date, i) => ({
          correctAnswers: i === 0 ? 63 : 60,
          date,
          incorrectAnswers: i === 0 ? 2 : 0,
          timeSpentSeconds: i === 0 ? 4200 : 3600,
          userId: user.id,
        })),
        { correctAnswers: 2, date: previous, timeSpentSeconds: 300, userId: user.id },
        { correctAnswers: 60, date: previousOther, timeSpentSeconds: 3600, userId: user.id },
      ]),
    ]);

    const own = await getWeeklyRecap({ goalId: goal.id, weekStart: "2026-10-12" });

    expect(own).toMatchObject({
      recap: {
        comparison: { days: 0, minutes: 5, questions: 3 },
        lastWeek: { averageMinutes: 5, daysStudied: [previous], minutes: 5, questions: 2 },
        week: { averageMinutes: 10, daysStudied: [MONDAY], minutes: 10, questions: 5 },
      },
      status: "ready",
    });

    const account = await getWeeklyRecap({ timeZone: "UTC", weekStart: "2026-10-12" });

    expect(account).toMatchObject({
      recap: {
        comparison: { days: 3, minutes: 245, questions: 243 },
        lastWeek: {
          averageMinutes: 33,
          daysStudied: [previousOther, previous],
          minutes: 65,
          questions: 62,
        },
        week: { averageMinutes: 62, daysStudied: dates, minutes: 310, questions: 305 },
      },
      status: "ready",
    });
  });

  it("chooses the default recap week from that goal's own study history", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
    const user = await userFixture();
    mockSession(user.id);
    const goal = await goalFixture({ timezone: "UTC", userId: user.id });

    await Promise.all([
      learningEventFixture({
        goalId: goal.id,
        localDate: new Date("2026-10-19T00:00:00Z"),
        seconds: 600,
        userId: user.id,
      }),
      dailyProgressFixtureMany([{ date: MONDAY, timeSpentSeconds: 3600, userId: user.id }]),
    ]);

    const result = await getWeeklyRecap({ goalId: goal.id });

    expect(result).toMatchObject({
      recap: { week: { minutes: 10 }, weekStart: new Date("2026-10-19T00:00:00Z") },
      status: "ready",
    });
  });
});
