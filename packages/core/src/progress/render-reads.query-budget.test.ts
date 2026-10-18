import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getBeltLevel } from "./get-belt-level";
import { getCurrentUserProgress } from "./get-current-user-progress";
import { getEnergyData } from "./get-energy-data";
import { getEnergyLevel } from "./get-energy-level";
import { getEnergyStarted } from "./get-energy-started";
import { getLearningActivity } from "./get-learning-activity";
import { getRequestProgressDateContext } from "./get-request-date-context";
import { getScoreHistory } from "./get-score-history";
import { getCurrentUserScorePatterns } from "./get-score-patterns";
import { getStudiedToday } from "./get-studied-today";

const TODAY = new Date("2026-10-14T00:00:00.000Z");

describe("stats render read statement budgets", () => {
  it.each([
    ["buddy energy", getEnergyLevel, 1],
    ["buddy studied", getStudiedToday, 1],
    ["overview", getCurrentUserProgress, 7],
    ["energy", getEnergyData, 2],
    ["energy started", getEnergyStarted, 1],
    ["level", getBeltLevel, 1],
    ["activity", getLearningActivity, 4],
    ["patterns", getCurrentUserScorePatterns, 2],
    ["score", () => getScoreHistory({ locale: "en" }), 1],
  ] as const)("keeps the read budget for %s", async (_name, read, budget) => {
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
    assertReadBudget(counts, budget);
    expect(counts.result).not.toBeNull();
  });
});
