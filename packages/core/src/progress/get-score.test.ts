import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession, mockSessionFailure } from "../_test-utils/mock-session";
import { getRequestProgressDateContext } from "./get-request-date-context";
import { getScore } from "./get-score";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("./get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

/** Fixes the instant and timezone used to derive the rolling Score window. */
function mockScoreDate(now: Date = new Date(), timeZone = "UTC") {
  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: now,
    currentInstant: now,
    timeZone,
  });
}

describe("unauthenticated users", () => {
  it("returns null", async () => {
    mockSession(null);
    mockScoreDate();

    const result = await getScore();

    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  it("propagates identity-provider failures", async () => {
    const error = new Error("Session lookup failed");
    mockSessionFailure(error);
    mockScoreDate();

    await expect(getScore()).rejects.toBe(error);
  });

  it("returns null when user has no DailyProgress records", async () => {
    const user = await userFixture();
    mockSession(user.id);
    mockScoreDate();

    const result = await getScore();

    expect(result).toBeNull();
  });

  it("returns score when user has DailyProgress records", async () => {
    const user = await userFixture();

    const today = new Date();
    mockSession(user.id);
    mockScoreDate(today);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await prisma.dailyProgress.createMany({
      data: [
        {
          correctAnswers: 17,
          date: today,
          dayOfWeek: today.getDay(),
          incorrectAnswers: 3,
          userId: user.id,
        },
        {
          correctAnswers: 8,
          date: yesterday,
          dayOfWeek: yesterday.getDay(),
          incorrectAnswers: 2,
          userId: user.id,
        },
      ],
    });

    const result = await getScore();

    // Total: 25 correct, 5 incorrect = 25/30 = 83.33...%
    expect(result).toMatchObject({ correctAnswers: 25, incorrectAnswers: 5, totalAnswers: 30 });
    expect(result?.score).toBeCloseTo(83.33, 1);
  });

  it("excludes records older than 3 months", async () => {
    const user = await userFixture();

    const today = new Date();
    mockSession(user.id);
    mockScoreDate(today);

    const oldDate = new Date(today);
    oldDate.setDate(oldDate.getDate() - 91);

    await prisma.dailyProgress.createMany({
      data: [
        {
          correctAnswers: 10,
          date: today,
          dayOfWeek: today.getDay(),
          incorrectAnswers: 0,
          userId: user.id,
        },
        {
          correctAnswers: 0,
          date: oldDate,
          dayOfWeek: oldDate.getDay(),
          incorrectAnswers: 100,
          userId: user.id,
        },
      ],
    });

    const result = await getScore();

    // Should only count today's data: 10/10 = 100%
    expect(result).toStrictEqual({
      correctAnswers: 10,
      incorrectAnswers: 0,
      score: 100,
      totalAnswers: 10,
    });
  });
});
