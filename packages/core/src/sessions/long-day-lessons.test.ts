import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { MAX_DAILY_MINUTES } from "../plans/daily-minutes";
import { getLearningShare } from "../plans/planner/plan-phases";
import { getTodayStudySession } from "./_test-utils/open-today";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";

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

  it("gives lessons the learn share of a whole day the learner gives, as the week counts the day", async () => {
    const user = await userFixture();

    const { goal } = await sessionGoalFixture({
      goal: { dailyMinutes: MAX_DAILY_MINUTES },
      itemsPerSkill: 1,
      lessons: 400,
      userId: user.id,
    });

    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);

    const result = await getTodayStudySession({});

    if (result.status !== "ready") {
      throw new Error(`Expected a session, got ${result.status}`);
    }

    const lessonMinutes = result.session.blocks
      .filter((block) => block.kind === "learn")
      .reduce((sum, block) => sum + block.estimatedMinutes, 0);

    const today = result.session.week.days.find((day) => day.isToday);
    const share = getLearningShare({ phaseKind: "learn", practiceBias: "balanced" });

    // The plan has more lessons than the day holds, so lessons fill their share of it: a walk with
    // no lessons written showed 4 hours of a 24-hour day, all the lessons there were.
    expect(lessonMinutes).toBe(MAX_DAILY_MINUTES * share);
    expect(today?.goalMinutes).toBe(MAX_DAILY_MINUTES);
  });
});
