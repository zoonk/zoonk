import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession, mockSessionFailure } from "../_test-utils/mock-session";
import { getRequestProgressDateContext } from "./get-request-date-context";
import { getScorePatterns } from "./get-score-patterns";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("./get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

/** Fixes the instant and timezone used to derive the rolling pattern window. */
function mockScoreDate(now: Date = new Date(), timeZone = "UTC") {
  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: now,
    currentInstant: now,
    timeZone,
  });
}

/**
 * Appends one finished activity to the ledger on a learner-local date and hour,
 * the only fields time-of-day patterns read besides the answer counts.
 */
function ledgerRow({
  correctAnswers,
  hour,
  incorrectAnswers,
  localDate,
  userId,
}: {
  correctAnswers: number;
  hour: number;
  incorrectAnswers: number;
  localDate: string;
  userId: string;
}) {
  return learningEventFixture({
    correctAnswers,
    hour,
    incorrectAnswers,
    localDate: new Date(`${localDate}T00:00:00.000Z`),
    userId,
  });
}

describe(getScorePatterns, () => {
  it("propagates identity-provider failures", async () => {
    const error = new Error("Session lookup failed");
    mockSessionFailure(error);
    mockScoreDate();

    await expect(getScorePatterns()).rejects.toBe(error);
  });

  it("returns null for unauthenticated users", async () => {
    mockSession(null);
    mockScoreDate();

    await expect(getScorePatterns()).resolves.toBeNull();
  });

  it("returns every observed group with counts and strongest score-volume rankings", async () => {
    const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);
    mockSession(user.id);
    mockScoreDate(new Date("2026-01-31T23:59:59.999Z"));

    const userId = user.id;

    await Promise.all([
      ledgerRow({
        correctAnswers: 1,
        hour: 3,
        incorrectAnswers: 1,
        localDate: "2026-01-15",
        userId,
      }),
      ledgerRow({
        correctAnswers: 2,
        hour: 9,
        incorrectAnswers: 0,
        localDate: "2026-01-15",
        userId,
      }),
      ledgerRow({
        correctAnswers: 1,
        hour: 15,
        incorrectAnswers: 0,
        localDate: "2026-01-15",
        userId,
      }),
      ledgerRow({
        correctAnswers: 0,
        hour: 17,
        incorrectAnswers: 1,
        localDate: "2026-01-16",
        userId,
      }),
      ledgerRow({
        correctAnswers: 10,
        hour: 21,
        incorrectAnswers: 0,
        localDate: "2026-02-15",
        userId,
      }),
      ledgerRow({
        correctAnswers: 10,
        hour: 21,
        incorrectAnswers: 0,
        localDate: "2026-01-15",
        userId: otherUser.id,
      }),
    ]);

    await prisma.dailyProgress.createMany({
      data: [
        {
          correctAnswers: 1,
          date: new Date("2026-01-04T00:00:00.000Z"),
          dayOfWeek: 0,
          incorrectAnswers: 1,
          userId: user.id,
        },
        {
          correctAnswers: 2,
          date: new Date("2026-01-05T00:00:00.000Z"),
          dayOfWeek: 1,
          userId: user.id,
        },
        {
          correctAnswers: 1,
          date: new Date("2026-01-06T00:00:00.000Z"),
          dayOfWeek: 2,
          userId: user.id,
        },
        {
          correctAnswers: 10,
          date: new Date("2026-02-01T00:00:00.000Z"),
          dayOfWeek: 3,
          userId: user.id,
        },
      ],
    });

    const result = await getScorePatterns();

    expect(result?.weekdays).toStrictEqual([
      { correctAnswers: 1, dayOfWeek: 0, incorrectAnswers: 1, score: 50, totalAnswers: 2 },
      { correctAnswers: 2, dayOfWeek: 1, incorrectAnswers: 0, score: 100, totalAnswers: 2 },
      { correctAnswers: 1, dayOfWeek: 2, incorrectAnswers: 0, score: 100, totalAnswers: 1 },
    ]);

    expect(result?.times).toStrictEqual([
      { correctAnswers: 1, incorrectAnswers: 1, period: 0, score: 50, totalAnswers: 2 },
      { correctAnswers: 2, incorrectAnswers: 0, period: 1, score: 100, totalAnswers: 2 },
      { correctAnswers: 1, incorrectAnswers: 1, period: 2, score: 50, totalAnswers: 2 },
    ]);

    expect(result?.strongestWeekday).toStrictEqual(result?.weekdays[1]);
    expect(result?.strongestTime).toStrictEqual(result?.times[1]);
  });

  it("uses the learner-local date range west of UTC", async () => {
    const now = new Date("2026-03-15T02:30:00.000Z");
    const timeZone = "America/Los_Angeles";
    const user = await userFixture();
    mockSession(user.id);
    mockScoreDate(now, timeZone);

    const userId = user.id;

    await Promise.all([
      ledgerRow({
        correctAnswers: 10,
        hour: 12,
        incorrectAnswers: 0,
        localDate: "2025-12-14",
        userId,
      }),
      ledgerRow({
        correctAnswers: 1,
        hour: 0,
        incorrectAnswers: 1,
        localDate: "2025-12-15",
        userId,
      }),
      ledgerRow({
        correctAnswers: 3,
        hour: 18,
        incorrectAnswers: 0,
        localDate: "2026-03-14",
        userId,
      }),
      ledgerRow({
        correctAnswers: 0,
        hour: 19,
        incorrectAnswers: 10,
        localDate: "2026-03-15",
        userId,
      }),
    ]);

    await prisma.dailyProgress.createMany({
      data: [
        {
          correctAnswers: 10,
          date: new Date("2025-12-14T00:00:00.000Z"),
          dayOfWeek: 0,
          userId: user.id,
        },
        {
          correctAnswers: 2,
          date: new Date("2025-12-15T00:00:00.000Z"),
          dayOfWeek: 1,
          userId: user.id,
        },
        {
          correctAnswers: 3,
          date: new Date("2026-03-14T00:00:00.000Z"),
          dayOfWeek: 6,
          userId: user.id,
        },
        {
          date: new Date("2026-03-15T00:00:00.000Z"),
          dayOfWeek: 0,
          incorrectAnswers: 10,
          userId: user.id,
        },
      ],
    });

    const result = await getScorePatterns();

    expect(result?.weekdays).toStrictEqual([
      { correctAnswers: 2, dayOfWeek: 1, incorrectAnswers: 0, score: 100, totalAnswers: 2 },
      { correctAnswers: 3, dayOfWeek: 6, incorrectAnswers: 0, score: 100, totalAnswers: 3 },
    ]);

    expect(result?.times).toStrictEqual([
      { correctAnswers: 1, incorrectAnswers: 1, period: 0, score: 50, totalAnswers: 2 },
      { correctAnswers: 3, incorrectAnswers: 0, period: 3, score: 100, totalAnswers: 3 },
    ]);

    expect(result?.strongestWeekday).toStrictEqual(result?.weekdays[1]);
    expect(result?.strongestTime).toStrictEqual(result?.times[1]);
  });

  it("counts a session's answers once, from its lessons and blocks", async () => {
    const user = await userFixture();
    mockSession(user.id);
    mockScoreDate(new Date("2026-01-31T23:59:59.999Z"));

    const endedAt = new Date("2026-01-15T09:30:00.000Z");
    const answers = { correctAnswers: 3, endedAt, incorrectAnswers: 1, userId: user.id };

    // The session's row sums the answers its lesson and question block already recorded.
    await Promise.all([
      learningEventFixture({ ...answers, correctAnswers: 2, incorrectAnswers: 0, kind: "lesson" }),
      learningEventFixture({
        ...answers,
        correctAnswers: 1,
        incorrectAnswers: 1,
        kind: "questions",
      }),
      learningEventFixture({ ...answers, kind: "session" }),
    ]);

    const result = await getScorePatterns();

    expect(result?.times).toStrictEqual([
      { correctAnswers: 3, incorrectAnswers: 1, period: 1, score: 75, totalAnswers: 4 },
    ]);
  });
});
