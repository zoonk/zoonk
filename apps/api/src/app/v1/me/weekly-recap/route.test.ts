import { weeklyRecapResponseSchema } from "@/lib/openapi/schemas/milestones";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
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
      kind: "rest",
      minutes: 10,
      studied: true,
    });

    expect(body.days.every((day) => day.goalMinutes === 0 && day.kind === "rest")).toBe(true);
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

    const response = await getRecap(
      new Request(`http://localhost/v1/me/weekly-recap?goalId=${goal.id}&weekStart=2026-10-12`),
    );

    expect(response.status).toBe(200);
    const body = weeklyRecapResponseSchema.parse(await response.json());
    expect(body.days).toHaveLength(7);

    expect(body.days[0]).toMatchObject({
      date: "2026-10-12",
      hitGoal: false,
      minutes: 1,
      studied: true,
    });

    expect(body.days[1]).toMatchObject({ date: "2026-10-13", hitGoal: true, studied: true });
    expect(body.days[2]).toMatchObject({ kind: "study", studied: false });
    expect(body.days.slice(5).map((day) => day.kind)).toStrictEqual(["rest", "rest"]);
    expect(body.days.every((day) => !day.isToday)).toBe(true);
  });
});
