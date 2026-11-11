import { type StudySessionBlock, prisma } from "@zoonk/db";
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
import { gradeChoiceAnswer, parseChoiceItem } from "../learner/_utils/choice-items";
import { SESSION_NOW, daysAgo } from "./_test-utils/session-goal";
import { toStudyBlockView } from "./_utils/session-view";
import { answerStudyQuestion } from "./answer-study-question";
import { getStudyBlock } from "./get-study-block";

async function drillBlockFixture(drill: Record<string, unknown>) {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

  const [item, goal] = await Promise.all([
    itemFixture({ content: choiceItemContent(), skillId: skill.id }),
    goalFixture({ timezone: "UTC", userId: user.id }),
  ]);

  const [mistake, session] = await Promise.all([
    mistakeFixture({
      createdAt: daysAgo(2),
      itemId: item.id,
      skillId: skill.id,
      snapshot: gradeChoiceAnswer({ answer: { selectedIndex: 1 }, item: parseChoiceItem(item)! })
        .snapshot,
      userId: user.id,
    }),
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

function practiceBlock(payload: StudySessionBlock["payload"]): StudySessionBlock {
  const now = new Date();

  return {
    brainPower: 0,
    canDo: null,
    completedAt: null,
    createdAt: now,
    estimatedMinutes: null,
    id: crypto.randomUUID(),
    kind: "practice",
    lessonId: null,
    payload,
    position: 0,
    sessionId: crypto.randomUUID(),
    startedAt: null,
    status: "pending",
    updatedAt: now,
  };
}

describe(toStudyBlockView, () => {
  it("says a practice block that only fixes mistakes is that, and a mixed one isn't", () => {
    const drills = [
      { itemIds: [crypto.randomUUID()], kind: "retry", mistakeId: crypto.randomUUID() },
    ];

    const answeredItemIds = new Set<string>();

    expect(toStudyBlockView({ answeredItemIds, block: practiceBlock({ drills }) })).toMatchObject({
      mistakesOnly: true,
    });

    expect(
      toStudyBlockView({
        answeredItemIds,
        block: practiceBlock({ drills, itemIds: [crypto.randomUUID()] }),
      }),
    ).toMatchObject({ mistakesOnly: false });
  });
});

describe("mistake drills in today's session", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("does not claim a trap after a right answer in a trap drill", async () => {
    const { block, item, session } = await drillBlockFixture({ kind: "spotTheTrap" });

    const result = await answerStudyQuestion({
      blockId: block.id,
      input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: item.id },
      sessionId: session.id,
    });

    expect(result).toMatchObject({
      feedback: { isCorrect: true, mistakeFixed: true, trap: null },
      status: "ready",
    });
  });
});
