import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { getScoreDateRange } from "../../progress/score-date-range";
import { getPlayerProgressSnapshot } from "./get-player-progress-snapshot";

const TODAY = new Date("2026-01-10T00:00:00Z");

vi.mock("../../progress/get-request-date-context", () => ({
  getRequestProgressDateContext: vi.fn(),
}));

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

describe(getPlayerProgressSnapshot, () => {
  beforeEach(() => {
    mockSession(null);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: TODAY,
      currentInstant: TODAY,
      timeZone: "UTC",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for an unauthenticated request", async () => {
    await expect(getPlayerProgressSnapshot()).resolves.toBeNull();
  });

  it("propagates progress infrastructure failures to the owning app", async () => {
    const user = await userFixture();
    mockSession(user.id);

    vi.spyOn(prisma.userProgress, "findUnique").mockRejectedValueOnce(
      new Error("Progress query failed"),
    );

    await expect(getPlayerProgressSnapshot()).rejects.toThrow("Progress query failed");
  });

  it("uses the same 90 learner-local dates as Score", async () => {
    const now = new Date("2026-07-23T12:30:00.000Z");
    const user = await userFixture();
    const dateRange = getScoreDateRange({ now, timeZone: "Pacific/Kiritimati" });
    mockSession(user.id);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: dateRange.dailyProgress.endDate,
      currentInstant: now,
      timeZone: "Pacific/Kiritimati",
    });

    await prisma.dailyProgress.createMany({
      data: [
        {
          correctAnswers: 10,
          date: new Date("2026-04-25T00:00:00.000Z"),
          dayOfWeek: 6,
          userId: user.id,
        },
        {
          correctAnswers: 1,
          date: new Date("2026-04-26T00:00:00.000Z"),
          dayOfWeek: 0,
          userId: user.id,
        },
        {
          brainPowerEarned: 42,
          correctAnswers: 2,
          date: new Date("2026-07-24T00:00:00.000Z"),
          dayOfWeek: 5,
          energyAtEnd: 87,
          interactiveCompleted: 1,
          staticCompleted: 2,
          userId: user.id,
        },
        {
          date: new Date("2026-07-25T00:00:00.000Z"),
          dayOfWeek: 6,
          incorrectAnswers: 10,
          userId: user.id,
        },
      ],
    });

    const result = await getPlayerProgressSnapshot();

    expect(result?.progressSnapshot.bestDayScores).toStrictEqual([
      { correctAnswers: 1, dayOfWeek: 0, incorrectAnswers: 0 },
      { correctAnswers: 2, dayOfWeek: 5, incorrectAnswers: 0 },
    ]);

    expect(result?.progressSnapshot).toMatchObject({
      todayBrainPower: 42,
      todayCompletedLessons: 3,
      todayEnergyAtEnd: 87,
      todayInteractiveLessons: 1,
    });
  });
});
