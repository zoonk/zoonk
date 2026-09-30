import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  SESSION_NOW,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { answerStudyQuestion } from "./answer-study-question";
import { readBlockPayload } from "./block-payload";
import { getStudyBlock } from "./get-study-block";
import { getTodayStudySession } from "./get-today-study-session";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// The classifier is a paid model call; its behavior is covered by its eval.
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));

/** An active practice block of today's session asking one mistake's drill, in any payload shape. */
async function drillBlockFixture(drill: Record<string, unknown>) {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

  const [item, goal] = await Promise.all([
    itemFixture({ content: choiceItemContent(), skillId: skill.id }),
    goalFixture({ timezone: "UTC", userId: user.id }),
  ]);

  const [mistake, session] = await Promise.all([
    mistakeFixture({ createdAt: daysAgo(2), itemId: item.id, skillId: skill.id, userId: user.id }),
    studySessionFixture({ goalId: goal.id, status: "active", userId: user.id }),
  ]);

  const block = await studySessionBlockFixture({
    kind: "practice",
    payload: { drills: [{ ...drill, itemIds: [item.id], mistakeId: mistake.id }] },
    sessionId: session.id,
    startedAt: new Date(),
    status: "active",
  });

  mockSession(user.id);

  return { block, item, mistake, session };
}

describe("mistake drills in today's session", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a content gap's drill with the lesson to go over first", async () => {
    const user = await userFixture();
    const fixture = await sessionGoalFixture({ lessons: 2, userId: user.id });
    const [skill] = fixture.skills;
    const [lesson] = fixture.lessons;

    await Promise.all([
      mistakeFixture({
        cause: "gap",
        createdAt: daysAgo(1),
        itemId: fixture.items[0]?.id,
        skillId: skill?.id,
        userId: user.id,
      }),
      prisma.planItem.update({ data: { status: "done" }, where: { id: fixture.planItems[0]?.id } }),
      dueSkillFixture({ skillId: skill?.id ?? "", userId: user.id }),
    ]);

    mockSession(user.id);
    const today = await getTodayStudySession({ goalId: fixture.goal.id });

    const blockId =
      today.status === "ready"
        ? today.session.blocks.find((block) => block.kind === "practice")?.id
        : undefined;

    const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });

    expect(readBlockPayload(block).drills[0]).toMatchObject({
      kind: "reteach",
      lessonId: lesson?.id,
      timeLimitSeconds: null,
    });

    const detail = await getStudyBlock({ blockId: block.id, sessionId: block.sessionId });

    const drilled =
      detail.status === "ready" ? detail.detail.questions.filter((question) => question.drill) : [];

    expect(drilled.length).toBeGreaterThan(0);

    expect(drilled[0]?.drill).toStrictEqual({
      kind: "reteach",
      lesson: { id: lesson?.id, ideas: [], title: lesson?.title },
      timeLimitSeconds: null,
    });
  });

  it("reads a drill without a kind as a plain retry", async () => {
    const { block, item, mistake, session } = await drillBlockFixture({});
    const detail = await getStudyBlock({ blockId: block.id, sessionId: session.id });

    expect(detail.status === "ready" && detail.detail.questions).toMatchObject([
      {
        drill: { kind: "retry", lesson: null, timeLimitSeconds: null },
        itemId: item.id,
        mistakeId: mistake.id,
      },
    ]);
  });

  it("counts a timed drill's answer that took the whole time box as wrong", async () => {
    const { block, item, mistake, session } = await drillBlockFixture({
      kind: "timed",
      timeLimitSeconds: 45,
    });

    const result = await answerStudyQuestion({
      blockId: block.id,
      input: { answer: { selectedIndex: 0 }, durationMs: 45_000, itemId: item.id },
      sessionId: session.id,
    });

    expect(result).toMatchObject({
      feedback: { isCorrect: false, mistakeFixed: false, trap: null },
      status: "ready",
    });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
    ).resolves.toMatchObject({ status: "open" });
  });

  it("names the trap after a right answer in a trap drill", async () => {
    const { block, item, session } = await drillBlockFixture({ kind: "spotTheTrap" });

    const result = await answerStudyQuestion({
      blockId: block.id,
      input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: item.id },
      sessionId: session.id,
    });

    expect(result).toMatchObject({
      feedback: { isCorrect: true, mistakeFixed: true, trap: "Applies the rule backwards" },
      status: "ready",
    });
  });
});
