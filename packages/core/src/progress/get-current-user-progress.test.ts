import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getCurrentUserProgress } from "./get-current-user-progress";
import { getRequestProgressDateContext } from "./get-request-date-context";
import { getCurrentUserScorePatterns } from "./get-score-patterns";

const CURRENT_DATE = new Date("2026-07-27T00:00:00.000Z");

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("./get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

describe(getCurrentUserProgress, () => {
  beforeEach(() => {
    mockSession(null);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: CURRENT_DATE,
      currentInstant: CURRENT_DATE,
      timeZone: "UTC",
    });
  });

  it("returns null without an authenticated learner", async () => {
    await expect(getCurrentUserProgress()).resolves.toBeNull();
  });

  it("composes compact caller-owned progress without detail collections", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await Promise.all([
      userProgressFixture({
        currentEnergy: 80,
        lastActiveAt: CURRENT_DATE,
        totalBrainPower: 15_000n,
        userId: user.id,
      }),
      dailyProgressFixtureMany([
        {
          correctAnswers: 3,
          date: CURRENT_DATE,
          energyAtEnd: 80,
          incorrectAnswers: 1,
          staticCompleted: 1,
          timeSpentSeconds: 120,
          userId: user.id,
        },
      ]),
    ]);

    const result = await getCurrentUserProgress();

    expect(result).toMatchObject({
      activity: { learningDays: 1, totalLearningSeconds: 120, totalLessonCompletions: 0 },
      energy: { currentEnergy: 80 },
      level: { level: 8, totalBrainPower: 15_000 },
      score: { correctAnswers: 3, incorrectAnswers: 1, score: 75, totalAnswers: 4 },
      scorePatterns: {
        strongestTime: null,
        strongestWeekday: { correctAnswers: 3, incorrectAnswers: 1, score: 75, totalAnswers: 4 },
      },
    });

    expect(result).not.toHaveProperty("days");
    expect(result).not.toHaveProperty("dataPoints");
  });

  it("returns complete pattern categories through the current-user resource", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await dailyProgressFixtureMany([{ correctAnswers: 1, date: CURRENT_DATE, userId: user.id }]);

    const result = await getCurrentUserScorePatterns();

    expect(result?.patterns?.weekdays).toHaveLength(7);
    expect(result?.patterns?.times).toHaveLength(4);

    expect(result?.patterns?.weekdays[CURRENT_DATE.getUTCDay()]).toMatchObject({
      correctAnswers: 1,
      incorrectAnswers: 0,
      score: 100,
      totalAnswers: 1,
    });

    expect(result?.patterns?.times).toStrictEqual([
      { correctAnswers: 0, incorrectAnswers: 0, period: 0, score: 0, totalAnswers: 0 },
      { correctAnswers: 0, incorrectAnswers: 0, period: 1, score: 0, totalAnswers: 0 },
      { correctAnswers: 0, incorrectAnswers: 0, period: 2, score: 0, totalAnswers: 0 },
      { correctAnswers: 0, incorrectAnswers: 0, period: 3, score: 0, totalAnswers: 0 },
    ]);
  });
});
