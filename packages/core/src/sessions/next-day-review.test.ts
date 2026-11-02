import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { recordLearnerAnswer } from "../learner/record-learner-answer";
import { getTodayStudySession } from "./_test-utils/open-today";
import { SESSION_NOW, daysAgo, sessionGoalFixture } from "./_test-utils/session-goal";

const RIGHT = { durationMs: 12_000, isCorrect: true };

async function studiedYesterday({
  before,
}: {
  before?: (fixture: Awaited<ReturnType<typeof sessionGoalFixture>>) => Promise<unknown>;
} = {}) {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ userId: user.id });
  const { goal, items, planItems, skills } = fixture;
  const [taughtSkill] = skills;
  const yesterday = daysAgo(1);

  await before?.(fixture);

  await Promise.all(
    items
      .filter((item) => item.skillId === taughtSkill?.id)
      .map((item, index) =>
        recordLearnerAnswer({
          answer: { selectedIndex: 0 },
          answeredAt: new Date(yesterday.getTime() + index * 60_000),
          graded: RIGHT,
          itemId: item.id,
          language: "en",
          purpose: "learning",
          skillId: item.skillId,
          timeZone: "UTC",
          userId: user.id,
        }),
      ),
  );

  await Promise.all([
    prisma.planItem.update({
      data: { completedAt: yesterday, status: "done" },
      where: { id: planItems[0]?.id },
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  mockSession(user.id);
  const today = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });

  if (today.status !== "ready") {
    throw new Error(`Expected a session, got ${today.status}`);
  }

  return { ...fixture, first: today.session.blocks[0] };
}

describe("a new learner's second day", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("names the review after the lesson the learner studied, never a later one on the same skill", async () => {
    const later = await libraryLessonFixture({ title: "Grouping by need" });

    const { first, lessons } = await studiedYesterday({
      before: ({ plan, skills }) =>
        Promise.all([
          prisma.lessonSkill.create({
            data: { createdAt: daysAgo(30), lessonId: later.id, skillId: skills[0]?.id ?? "" },
          }),
          planItemFixture({
            kind: "lesson",
            lessonId: later.id,
            phase: 0,
            planId: plan.id,
            position: 10,
            titleSnapshot: later.title,
          }),
        ]),
    });

    expect(first?.kind).toBe("review");

    expect(first?.capsules.map((capsule) => [capsule.lessonId, capsule.title])).toStrictEqual([
      [lessons[0]?.id, lessons[0]?.title],
    ]);
  });
});
