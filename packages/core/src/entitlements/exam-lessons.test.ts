import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { sessionGoalFixture } from "../sessions/_test-utils/session-goal";

describe("exam lesson admission", () => {
  it("admits an older exam goal's twentieth lesson, refuses the next, and resumes the admitted lesson", async () => {
    const user = await userFixture();

    const { goal, plan } = await sessionGoalFixture({
      goal: { createdAt: new Date("2020-01-01"), kind: "exam" },
      userId: user.id,
    });

    const [first, next] = await Promise.all([playableLessonFixture(), playableLessonFixture()]);

    await Promise.all([
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      usageRecordsFixture({ count: 19, createdAt: new Date(), userId: user.id }),
      ...[first, next].map(({ lesson }, position) =>
        planItemFixture({
          kind: "lesson",
          lessonId: lesson.id,
          planId: plan.id,
          position: 100 + position,
        }),
      ),
    ]);

    mockSession(user.id);
    const started = await startLibraryLesson({ input: {}, lessonId: first.lesson.id });
    expect(started.status).toBe("started");

    await expect(
      startLibraryLesson({ input: {}, lessonId: next.lesson.id }),
    ).resolves.toMatchObject({
      limit: { limit: 20, period: "month", resource: "lessonStart", tier: "free" },
      status: "limitReached",
    });

    const resumed = await startLibraryLesson({ input: {}, lessonId: first.lesson.id });
    expect(resumed.status).toBe("started");

    expect(started).toHaveProperty("run");
    expect(resumed).toMatchObject(started);

    await expect(
      prisma.usageRecord.count({ where: { kind: "lessonStart", userId: user.id } }),
    ).resolves.toBe(20);
  });
});
