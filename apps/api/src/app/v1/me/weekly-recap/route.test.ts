import { weeklyRecapResponseSchema } from "@/lib/openapi/schemas/milestones";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockAccountSession } from "../../../../../../../packages/core/src/_test-utils/mock-session";
import { GET as getRecap } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

describe("GET /v1/me/weekly-recap", () => {
  it("returns unplanned days without study obligations when no goal is selected", async () => {
    const user = await userFixture();
    mockAccountSession({ user });

    await dailyProgressFixtureMany([
      { date: new Date("2026-10-12T00:00:00Z"), timeSpentSeconds: 600, userId: user.id },
    ]);

    const response = await getRecap(
      new Request("http://localhost/v1/me/weekly-recap?weekStart=2026-10-12&timeZone=UTC"),
    );

    expect(response.status).toBe(200);
    const body = weeklyRecapResponseSchema.parse(await response.json());

    expect(body.days[0]).toMatchObject({
      goalMinutes: 0,
      hitGoal: true,
      kind: "rest",
      minutes: 10,
      studied: true,
    });

    expect(body.days.every((day) => day.goalMinutes === 0 && day.kind === "rest")).toBe(true);
  });

  it("returns goal-specific studied dates for clients using the legacy week date list", async () => {
    const user = await userFixture();
    mockAccountSession({ user });

    const [goal, other] = await Promise.all([
      goalFixture({ timezone: "UTC", userId: user.id }),
      goalFixture({ userId: user.id }),
    ]);

    const date = new Date("2026-10-13T00:00:00Z");

    await Promise.all([
      learningEventFixture({ goalId: other.id, localDate: date, seconds: 900, userId: user.id }),
      dailyProgressFixtureMany([{ date, timeSpentSeconds: 900, userId: user.id }]),
    ]);

    const response = await getRecap(
      new Request(`http://localhost/v1/me/weekly-recap?goalId=${goal.id}&weekStart=2026-10-12`),
    );

    expect(response.status).toBe(200);
    const body = weeklyRecapResponseSchema.parse(await response.json());

    expect(body.week).toStrictEqual({
      averageMinutes: 0,
      daysStudied: [],
      minutes: 0,
      questions: 0,
    });

    expect(body.lastWeek).toStrictEqual({
      averageMinutes: 0,
      daysStudied: [],
      minutes: 0,
      questions: 0,
    });

    expect(body.comparison).toStrictEqual({ days: 0, minutes: 0, questions: 0 });
    expect(body.days.filter((day) => day.studied)).toStrictEqual([]);
  });

  it("serializes partial study, completed sessions, missed study and rest days", async () => {
    const user = await userFixture();
    mockAccountSession({ user });

    const goal = await goalFixture({
      createdAt: new Date("2026-01-01T00:00:00Z"),
      timezone: "UTC",
      userId: user.id,
    });

    await planFixture({
      goalId: goal.id,
      settings: { weekdayMinutes: [0, 20, 20, 20, 20, 20, 0] },
    });

    await Promise.all([
      learningEventFixture({
        goalId: goal.id,
        localDate: new Date("2026-10-12T00:00:00Z"),
        seconds: 60,
        userId: user.id,
      }),
      studySessionFixture({
        endedAt: new Date("2026-10-13T12:00:00Z"),
        goalId: goal.id,
        localDate: new Date("2026-10-13T00:00:00Z"),
        plannedMinutes: 20,
        userId: user.id,
      }),
    ]);

    const partial = await studySessionFixture({
      goalId: goal.id,
      localDate: new Date("2026-10-14T00:00:00Z"),
      userId: user.id,
    });

    await studySessionBlockFixture({ sessionId: partial.id });

    await learningEventFixture({
      goalId: goal.id,
      localDate: partial.localDate,
      seconds: 60,
      userId: user.id,
    });

    const response = await getRecap(
      new Request(`http://localhost/v1/me/weekly-recap?goalId=${goal.id}&weekStart=2026-10-12`),
    );

    expect(response.status).toBe(200);
    const body = weeklyRecapResponseSchema.parse(await response.json());
    expect(body.days).toHaveLength(7);

    expect(body.days[0]).toMatchObject({
      date: "2026-10-12",
      hitGoal: true,
      minutes: 1,
      studied: true,
    });

    expect(body.days[1]).toMatchObject({ date: "2026-10-13", hitGoal: true, studied: true });

    expect(body.days[2]).toMatchObject({
      completed: 0,
      hitGoal: false,
      kind: "study",
      studied: true,
      total: 1,
    });

    expect(body.days[3]).toMatchObject({ kind: "study", studied: false });
    expect(body.days.slice(5).map((day) => day.kind)).toStrictEqual(["rest", "rest"]);
    expect(body.days.every((day) => !day.isToday)).toBe(true);
  });
});
