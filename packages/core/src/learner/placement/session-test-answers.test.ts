import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { describe, expect, it } from "vitest";
import { PLAN_SHOWN, examTestGoalFixture } from "../_test-utils/exam-test-goal";
import { getGoalPlacement } from "./get-goal-placement";

describe("test questions answered in a session", () => {
  it("stay the test's evidence after 1,000 later answers", async () => {
    const { goal, items, skills, user } = await examTestGoalFixture({
      goal: { ...PLAN_SHOWN, timezone: "UTC" },
      subjects: [{ items: 3, name: "Math", questions: 10 }],
    });

    const asking = await studySessionFixture({ goalId: goal.id, userId: user.id });
    const start = Date.now() - 60 * 60_000;

    await Promise.all(
      [0, 1].map((index) =>
        attemptFixture({
          answeredAt: new Date(start + index),
          isCorrect: true,
          isPlacement: true,
          itemId: items[index]!.id,
          skillId: skills[0]!.id,
          studySessionId: asking.id,
          userId: user.id,
        }),
      ),
    );

    const before = await getGoalPlacement({ goalId: goal.id });
    expect(before.status === "ready" && before.placement.complete).toBe(true);

    expect(before.status === "ready" && before.placement.knownSkillIds).toStrictEqual([
      skills[0]!.id,
    ]);

    const session = asking;
    const at = new Date(start + 60_000);

    await prisma.attempt.createMany({
      data: Array.from({ length: 1000 }, (_, index) => ({
        answer: { selectedIndex: 0 },
        answeredAt: new Date(at.getTime() + index),
        durationMs: 1000,
        hour: 12,
        isCorrect: true,
        localDate: at,
        skillId: skills[0]!.id,
        studySessionId: session.id,
        userId: user.id,
        weekday: 1,
      })),
    });

    const after = await getGoalPlacement({ goalId: goal.id });
    expect(after.status === "ready" && after.placement.complete).toBe(true);

    expect(after.status === "ready" && after.placement.knownSkillIds).toStrictEqual([
      skills[0]!.id,
    ]);
  });
});
