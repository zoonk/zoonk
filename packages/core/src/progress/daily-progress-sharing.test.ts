import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { readLifetimeDailyProgress } from "./_utils/daily-progress-rows";
import { getCurrentUserProgress } from "./get-current-user-progress";
import { getEnergyData } from "./get-energy-data";
import { getEnergyStarted } from "./get-energy-started";
import { getLearningActivity } from "./get-learning-activity";
import { getRequestProgressDateContext } from "./get-request-date-context";
import { getScoreHistory } from "./get-score-history";
import { getCurrentUserScorePatterns } from "./get-score-patterns";

const TODAY = new Date("2026-10-14T00:00:00Z");
const DAY = 86_400_000;
const LIFETIME = { history: "lifetime" } as const;

function readOverview(shared: boolean) {
  return Promise.all([
    shared ? getCurrentUserProgress(LIFETIME) : getCurrentUserProgress(),
    getEnergyData(),
    shared ? getEnergyStarted(LIFETIME) : getEnergyStarted(),
    shared ? getLearningActivity(LIFETIME) : getLearningActivity(),
    shared ? getCurrentUserScorePatterns(LIFETIME) : getCurrentUserScorePatterns(),
    getScoreHistory({ ...(shared ? LIFETIME : {}), locale: "en" }),
  ]);
}

describe("shared daily progress on the statistics overview", () => {
  beforeEach(() => {
    mockSession(null);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: TODAY,
      currentInstant: TODAY,
      timeZone: "UTC",
    });
  });

  it("matches the existing readers across lifetime, calendar and 90-day boundaries", async () => {
    const [learner, other] = await Promise.all([userFixture(), userFixture()]);

    await Promise.all([
      userProgressFixture({
        currentEnergy: 80,
        lastActiveAt: TODAY,
        totalBrainPower: 15_000n,
        userId: learner.id,
      }),
      dailyProgressFixtureMany(
        Array.from({ length: 402 }, (_, index) => ({
          correctAnswers: index % 7,
          date: new Date(TODAY.getTime() - (400 - index) * DAY),
          energyAtEnd: index % 100,
          incorrectAnswers: index % 3,
          interactiveCompleted: index % 2,
          lessonsCompleted: index % 5,
          staticCompleted: index % 3,
          timeSpentSeconds: index * 10,
          userId: learner.id,
        })),
      ),
      dailyProgressFixtureMany([
        { correctAnswers: 1000, date: TODAY, lessonsCompleted: 1000, userId: other.id },
      ]),
      learningEventFixture({ correctAnswers: 8, endedAt: TODAY, hour: 12, userId: learner.id }),
    ]);

    mockSession(learner.id);

    const [original, shared] = await Promise.all([readOverview(false), readOverview(true)]);
    expect(shared).toStrictEqual(original);

    const ledger = await countDatabaseStatements(() => readLifetimeDailyProgress(learner.id));
    assertReadBudget(ledger, 1);
    expect(ledger.result).toHaveLength(402);
    expect(ledger.result.every((row) => row.userId === learner.id)).toBe(true);

    const history = await getScoreHistory({ locale: "en" });
    expect(history?.periodStart).toStrictEqual(new Date(TODAY.getTime() - 89 * DAY));
    expect(history?.periodEnd).toStrictEqual(TODAY);
    expect(history?.totalAnswers).toBeLessThan(1000);
    await expect(prisma.dailyProgress.count({ where: { userId: learner.id } })).resolves.toBe(402);
  });

  it("preserves visitor and new-learner empty states", async () => {
    await expect(readOverview(true)).resolves.toStrictEqual(await readOverview(false));

    const learner = await userFixture();
    mockSession(learner.id);
    await expect(readOverview(true)).resolves.toStrictEqual(await readOverview(false));
  });
});
