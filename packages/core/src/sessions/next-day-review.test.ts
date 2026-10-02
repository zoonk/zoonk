import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { recordLearnerAnswer } from "../learner/record-learner-answer";
import { SESSION_NOW, daysAgo, sessionGoalFixture } from "./_test-utils/session-goal";
import { getTodayStudySession } from "./get-today-study-session";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const RIGHT = { durationMs: 12_000, isCorrect: true };

describe("a new learner's second day", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens with a review of what yesterday's lesson taught", async () => {
    const user = await userFixture();

    const { goal, items, lessons, planItems, skills } = await sessionGoalFixture({
      userId: user.id,
    });

    const [taughtSkill] = skills;
    const yesterday = daysAgo(1);

    // Yesterday's first lesson: its questions, answered right while learning the skill.
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

    const [first] = today.session.blocks;

    expect(first?.kind).toBe("review");
    expect(first?.capsules.map((capsule) => capsule.lessonId)).toContain(lessons[0]?.id);
  });
});
