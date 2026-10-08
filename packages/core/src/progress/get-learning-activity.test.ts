import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getLearningActivity } from "./get-learning-activity";
import { getRequestProgressDateContext } from "./get-request-date-context";

const CURRENT_DATE = new Date("2025-01-10T00:00:00Z");
const NEXT_DATE = new Date("2025-01-11T00:00:00Z");

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("./get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

/** Fixes the learner-local date used to build the Activity calendar. */
function mockCurrentDate(currentDate: Date) {
  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate,
    currentInstant: currentDate,
    timeZone: "UTC",
  });
}

describe("unauthenticated users", () => {
  it("returns null", async () => {
    mockSession(null);
    mockCurrentDate(CURRENT_DATE);

    const result = await getLearningActivity();

    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  it("returns empty lifetime totals and a complete calendar window without progress", async () => {
    const user = await userFixture();
    mockSession(user.id);
    mockCurrentDate(CURRENT_DATE);

    const result = await getLearningActivity();

    expect(result).toMatchObject({
      learningDays: 0,
      totalLearningSeconds: 0,
      totalLessonCompletions: 0,
    });

    expect(result?.days).toHaveLength(370);

    expect(result?.days.at(0)).toStrictEqual({
      activitiesCompleted: 0,
      date: new Date("2024-01-07T00:00:00Z"),
      lessonCompletions: 0,
    });

    expect(result?.days.at(-1)).toStrictEqual({
      activitiesCompleted: 0,
      date: new Date("2025-01-10T00:00:00Z"),
      lessonCompletions: 0,
    });
  });

  it("ends an empty calendar on the learner's current local date", async () => {
    const user = await userFixture();
    mockSession(user.id);
    mockCurrentDate(NEXT_DATE);

    const result = await getLearningActivity();

    expect(result?.days.at(-1)).toStrictEqual({
      activitiesCompleted: 0,
      date: new Date("2025-01-11T00:00:00Z"),
      lessonCompletions: 0,
    });
  });

  it("lights the calendar on every learning day, the same days the lifetime total counts", async () => {
    const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);
    mockSession(user.id);
    mockCurrentDate(CURRENT_DATE);

    await dailyProgressFixtureMany([
      {
        date: new Date("2024-01-01T00:00:00Z"),
        lessonsCompleted: 1,
        staticCompleted: 2,
        timeSpentSeconds: 60,
        userId: user.id,
      },
      {
        date: new Date("2025-01-05T00:00:00Z"),
        interactiveCompleted: 1,
        lessonsCompleted: 1,
        staticCompleted: 2,
        timeSpentSeconds: 120,
        userId: user.id,
      },
      { date: new Date("2025-01-06T00:00:00Z"), timeSpentSeconds: 30, userId: user.id },
      {
        date: new Date("2025-01-07T00:00:00Z"),
        interactiveCompleted: 2,
        timeSpentSeconds: 300,
        userId: user.id,
      },
      {
        date: new Date("2025-01-08T00:00:00Z"),
        lessonsCompleted: 2,
        staticCompleted: 1,
        timeSpentSeconds: 45,
        userId: user.id,
      },
      { date: new Date("2025-01-09T00:00:00Z"), lessonsCompleted: 1, userId: user.id },
      {
        date: new Date("2025-01-05T00:00:00Z"),
        interactiveCompleted: 5,
        lessonsCompleted: 5,
        timeSpentSeconds: 600,
        userId: otherUser.id,
      },
    ]);

    const result = await getLearningActivity();

    expect(result).toMatchObject({
      learningDays: 5,
      totalLearningSeconds: 555,
      totalLessonCompletions: 5,
    });

    expect(
      result?.days.find((day) => day.date.getTime() === new Date("2025-01-05T00:00:00Z").getTime()),
    ).toStrictEqual({
      activitiesCompleted: 3,
      date: new Date("2025-01-05T00:00:00Z"),
      lessonCompletions: 1,
    });

    // Time alone (a lesson left halfway) isn't a learning day, in the calendar or the total.
    expect(
      result?.days.find((day) => day.date.getTime() === new Date("2025-01-06T00:00:00Z").getTime()),
    ).toStrictEqual({
      activitiesCompleted: 0,
      date: new Date("2025-01-06T00:00:00Z"),
      lessonCompletions: 0,
    });

    // A day of reviews and practice only, with no lesson finished, still counts as a learning day.
    expect(
      result?.days.find((day) => day.date.getTime() === new Date("2025-01-07T00:00:00Z").getTime()),
    ).toStrictEqual({
      activitiesCompleted: 2,
      date: new Date("2025-01-07T00:00:00Z"),
      lessonCompletions: 0,
    });

    // Days kept from before learning v2 have only their lesson count.
    expect(
      result?.days.find((day) => day.date.getTime() === new Date("2025-01-09T00:00:00Z").getTime()),
    ).toStrictEqual({
      activitiesCompleted: 1,
      date: new Date("2025-01-09T00:00:00Z"),
      lessonCompletions: 1,
    });

    expect(result?.days.filter((day) => day.activitiesCompleted > 0)).toHaveLength(4);

    expect(result?.days.some((day) => day.date < new Date("2024-01-07T00:00:00Z"))).toBe(false);
  });

  it("uses the learner-local completion date near the server day boundary", async () => {
    const user = await userFixture();
    mockSession(user.id);
    mockCurrentDate(NEXT_DATE);

    await dailyProgressFixtureMany([
      {
        date: new Date("2025-01-11T00:00:00Z"),
        interactiveCompleted: 1,
        lessonsCompleted: 1,
        userId: user.id,
      },
    ]);

    const result = await getLearningActivity();

    expect(result?.days.at(-1)).toStrictEqual({
      activitiesCompleted: 1,
      date: new Date("2025-01-11T00:00:00Z"),
      lessonCompletions: 1,
    });
  });
});
