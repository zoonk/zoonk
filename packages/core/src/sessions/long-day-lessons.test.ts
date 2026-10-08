import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { getTodayStudySession } from "./get-today-study-session";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

describe("a long study day", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("studies as many of the plan's lessons as two hours hold, not only the first few", async () => {
    const user = await userFixture();

    const { goal, lessons } = await sessionGoalFixture({
      goal: { dailyMinutes: 120 },
      itemsPerSkill: 1,
      lessons: 30,
      userId: user.id,
    });

    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);

    const result = await getTodayStudySession({});

    if (result.status !== "ready") {
      throw new Error(`Expected a session, got ${result.status}`);
    }

    const learnLessons = result.session.blocks.flatMap((block) =>
      block.kind === "learn" ? [block.lessonId] : [],
    );

    // Each lesson is a few minutes: two hours, less reviews and practice, hold well over eight.
    expect(learnLessons.length).toBeGreaterThan(8);

    expect(learnLessons).toStrictEqual(
      lessons.slice(0, learnLessons.length).map((lesson) => lesson.id),
    );
  });
});
