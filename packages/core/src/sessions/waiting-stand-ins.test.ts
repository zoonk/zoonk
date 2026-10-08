import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { getTodayStudySession } from "./get-today-study-session";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** More stand-ins than the lessons a session looks ahead at. */
const STAND_INS = 12;

describe("stand-ins for lessons the Library hasn't outlined yet", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("don't keep today's session from the written lessons after them", async () => {
    const user = await userFixture();

    const { goal, lessons, plan, planItems, skills } = await sessionGoalFixture({
      lessons: 1,
      userId: user.id,
    });

    // A language plan keeps each situation's size: what the course hasn't outlined waits ahead.
    await prisma.planItem.update({
      data: { position: STAND_INS },
      where: { id: planItems[0]?.id },
    });

    await Promise.all([
      ...Array.from({ length: STAND_INS }, (_, position) =>
        planItemFixture({
          kind: "lesson",
          planId: plan.id,
          position,
          skillId: skills[0]?.id,
          titleSnapshot: "Stand-in",
        }),
      ),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    mockSession(user.id);
    const result = await getTodayStudySession({});

    if (result.status !== "ready") {
      throw new Error(`Expected a session, got ${result.status}`);
    }

    const learnLessons = result.session.blocks.flatMap((block) =>
      block.kind === "learn" ? [block.lessonId] : [],
    );

    expect(learnLessons).toStrictEqual([lessons[0]?.id]);
  });
});
