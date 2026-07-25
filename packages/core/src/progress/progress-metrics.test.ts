import { prisma } from "@zoonk/db";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { getTotalLearningDays, getTotalLearningTime, getUserProgress } from "./progress-metrics";

describe("progress metrics", () => {
  it("returns zero totals for a learner without progress", async () => {
    const user = await userFixture();

    const [progress, learningDays, learningTime] = await Promise.all([
      getUserProgress({ userId: user.id }),
      getTotalLearningDays({ userId: user.id }),
      getTotalLearningTime({ userId: user.id }),
    ]);

    expect(progress).toBeNull();
    expect(learningDays).toStrictEqual({ learningDays: 0 });
    expect(learningTime).toStrictEqual({ totalLearningSeconds: 0 });
  });

  it("returns only the requested learner's durable totals", async () => {
    const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);

    await Promise.all([
      prisma.userProgress.create({
        data: { currentEnergy: 50, totalBrainPower: 120n, userId: user.id },
      }),
      dailyProgressFixtureMany([
        {
          date: new Date("2025-01-04T00:00:00Z"),
          staticCompleted: 1,
          timeSpentSeconds: 120,
          userId: user.id,
        },
        {
          date: new Date("2025-01-05T00:00:00Z"),
          interactiveCompleted: 1,
          timeSpentSeconds: 45,
          userId: user.id,
        },
        { date: new Date("2025-01-06T00:00:00Z"), timeSpentSeconds: 300, userId: otherUser.id },
      ]),
    ]);

    const [progress, learningDays, learningTime] = await Promise.all([
      getUserProgress({ userId: user.id }),
      getTotalLearningDays({ userId: user.id }),
      getTotalLearningTime({ userId: user.id }),
    ]);

    expect(progress).toMatchObject({ currentEnergy: 50, totalBrainPower: 120n, userId: user.id });
    expect(learningDays).toStrictEqual({ learningDays: 2 });
    expect(learningTime).toStrictEqual({ totalLearningSeconds: 165 });
  });
});
