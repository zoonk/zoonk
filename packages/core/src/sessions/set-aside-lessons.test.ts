import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { heldBackDraftFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { getTodayStudySession } from "./get-today-study-session";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

describe("a lesson set aside after its drafts were held back", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is left out of today's session, which moves on to the plan's next lessons", async () => {
    const user = await userFixture();
    const { goal, lessons } = await sessionGoalFixture({ userId: user.id });
    const [first, setAside, third] = lessons;

    // A plan that still lists the lesson, like one built after it was set aside.
    await Promise.all([
      prisma.lesson.update({
        data: {
          contentStatus: "failed",
          heldBackDrafts: [heldBackDraftFixture(), heldBackDraftFixture(), heldBackDraftFixture()],
          setAsideAt: SESSION_NOW,
        },
        where: { id: setAside?.id },
      }),
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

    expect(learnLessons).toStrictEqual([first?.id, third?.id]);
  });
});
