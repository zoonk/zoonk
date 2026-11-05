import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getBeltLevel } from "./get-belt-level";
import { getCurrentUserProgress } from "./get-current-user-progress";
import { getEnergyData } from "./get-energy-data";
import { getEnergyLevel } from "./get-energy-level";
import { getLearningActivity } from "./get-learning-activity";
import { getRequestProgressDateContext } from "./get-request-date-context";
import { getScoreHistory } from "./get-score-history";
import { getCurrentUserScorePatterns } from "./get-score-patterns";
import { getStudiedToday } from "./get-studied-today";

const TODAY = new Date("2026-10-14T00:00:00.000Z");

describe("stats render reads", () => {
  it.each([
    ["buddy energy", getEnergyLevel],
    ["buddy studied", getStudiedToday],
    ["overview", getCurrentUserProgress],
    ["energy", getEnergyData],
    ["level", getBeltLevel],
    ["activity", getLearningActivity],
    ["patterns", getCurrentUserScorePatterns],
    ["score", () => getScoreHistory({ locale: "en" })],
  ] as const)("reads %s without writing", async (_name, read) => {
    const user = await userFixture();

    await Promise.all([
      userProgressFixture({
        currentEnergy: 80,
        lastActiveAt: TODAY,
        totalBrainPower: 15_000n,
        userId: user.id,
      }),
      dailyProgressFixtureMany([
        {
          correctAnswers: 9,
          date: TODAY,
          energyAtEnd: 80,
          incorrectAnswers: 3,
          staticCompleted: 1,
          timeSpentSeconds: 120,
          userId: user.id,
        },
      ]),
    ]);

    mockSession(user.id);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: TODAY,
      currentInstant: TODAY,
      timeZone: "UTC",
    });

    const counts = await countDatabaseStatements(async () => read());
    expect(counts.writes).toBe(0);
    expect(counts.result).not.toBeNull();
  });
});
