import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { claimLessonQuestionAnswer } from "./answer-lifecycle";
import { createLessonQuestion } from "./create-lesson-question";
import { getBuddyConversationGoalId } from "./get-buddy-conversation-goal";
import { listBuddyConversations } from "./list-buddy-conversations";

async function ask({
  conversationId,
  goalId,
  question,
}: {
  conversationId: string;
  goalId: string;
  question: string;
}) {
  const result = await createLessonQuestion({
    input: { context: { kind: "plan" }, question, requestId: randomUUID() },
    target: { conversationId, goalId, kind: "plan" },
  });

  if (result.status !== "created") {
    throw new Error(`Expected a created question, got ${result.status}`);
  }

  return result.question;
}

function completeTurn(id: string, answer: string) {
  return prisma.lessonQuestion.update({ data: { answer, status: "completed" }, where: { id } });
}

describe("Buddy conversations", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses only the claimed question's own conversation when building model history", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    await planFixture({ goalId: goal.id, graph: { phases: [], skills: [] } });
    mockSession(user.id);

    const first = { conversationId: randomUUID(), goalId: goal.id };
    const second = { conversationId: randomUUID(), goalId: goal.id };

    const opener = await ask({ ...first, question: "How do I start?" });
    await completeTurn(opener.id, "Start with the overview.");

    const sibling = await ask({ ...second, question: "How do I practice?" });

    await expect(claimLessonQuestionAnswer({ questionId: sibling.id })).resolves.toMatchObject({
      claim: { priorTurns: [] },
      status: "ready",
    });

    await completeTurn(sibling.id, "Try one question.");

    const followUp = await ask({ ...first, question: "What comes after that?" });

    await expect(claimLessonQuestionAnswer({ questionId: followUp.id })).resolves.toMatchObject({
      claim: { priorTurns: [{ answer: "Start with the overview.", question: opener.question }] },
      status: "ready",
    });
  });

  it("lists only nonempty plan threads with stable paging and picks today in the goal's zone", async () => {
    const user = await userFixture();

    const [goal, otherGoal] = await Promise.all([
      goalFixture({ timezone: "America/Los_Angeles", userId: user.id }),
      goalFixture({ userId: user.id }),
    ]);

    mockSession(user.id);

    const firstAskedAt = new Date("2030-01-02T06:00:00Z");
    const lastAskedAt = new Date("2030-01-02T07:59:00Z");
    const latestId = randomUUID();
    const emptyId = randomUUID();
    const otherGoalId = randomUUID();

    const earlierIds = Array.from({ length: 30 }, () => randomUUID())
      .toSorted()
      .toReversed();

    const threads = [
      { goalId: goal.id, id: latestId, updatedAt: new Date("2030-01-02T08:01:00Z") },
      { goalId: goal.id, id: emptyId, updatedAt: new Date("2030-01-02T10:00:00Z") },
      { goalId: otherGoal.id, id: otherGoalId, updatedAt: lastAskedAt },
      ...earlierIds.map((id) => ({ goalId: goal.id, id, updatedAt: firstAskedAt })),
    ];

    await prisma.lessonQuestionThread.createMany({
      data: threads.map((thread) => ({ ...thread, kind: "plan", userId: user.id })),
    });

    const turns = [
      { createdAt: firstAskedAt, question: "  Where\n\t do I   start? ", threadId: latestId },
      { createdAt: lastAskedAt, question: "What comes next?", threadId: latestId },
      ...[otherGoalId, ...earlierIds].map((threadId) => ({
        createdAt: firstAskedAt,
        question: "An earlier question",
        threadId,
      })),
    ];

    await prisma.lessonQuestion.createMany({
      data: turns.map((turn) => ({
        ...turn,
        contextKind: "plan",
        contextSnapshot: {},
        requestFingerprint: "fixture",
        requestId: randomUUID(),
      })),
    });

    vi.setSystemTime(new Date("2030-01-02T07:59:59Z"));

    const { result: firstPage, writes } = await countDatabaseStatements(() =>
      listBuddyConversations({ goalId: goal.id }),
    );

    if (firstPage.status !== "ready") {
      throw new Error(`Expected conversations, got ${firstPage.status}`);
    }

    expect(writes).toBe(0);
    expect(firstPage.currentId).toBe(latestId);

    expect(firstPage.conversations.map(({ id }) => id)).toStrictEqual([
      latestId,
      ...earlierIds.slice(0, 29),
    ]);

    expect(firstPage.conversations[0]).toStrictEqual({
      id: latestId,
      lastAskedAt: lastAskedAt.toISOString(),
      title: "Where do I start?",
    });

    const boundary = firstPage.conversations.at(-1);

    if (!boundary || !firstPage.nextCursor) {
      throw new Error("Expected a boundary conversation and cursor");
    }

    await expect(
      listBuddyConversations({ cursor: firstPage.nextCursor, goalId: goal.id }),
    ).resolves.toMatchObject({
      conversations: [{ id: earlierIds[29] }],
      currentId: latestId,
      nextCursor: null,
    });

    const movedAt = new Date("2030-01-02T07:59:30Z");

    await prisma.lessonQuestionThread.update({
      data: {
        questions: {
          create: {
            contextKind: "plan",
            contextSnapshot: {},
            createdAt: movedAt,
            question: "Can you give another example?",
            requestFingerprint: "fixture",
            requestId: randomUUID(),
          },
        },
        updatedAt: movedAt,
      },
      where: { id: boundary.id },
    });

    await expect(
      listBuddyConversations({ cursor: firstPage.nextCursor, goalId: goal.id }),
    ).resolves.toMatchObject({ conversations: [{ id: earlierIds[29] }], nextCursor: null });

    await expect(
      listBuddyConversations({ cursor: firstPage.nextCursor, goalId: otherGoal.id }),
    ).resolves.toStrictEqual({ status: "invalidCursor" });

    await expect(
      listBuddyConversations({ cursor: otherGoalId, goalId: goal.id }),
    ).resolves.toStrictEqual({ status: "invalidCursor" });

    await expect(getBuddyConversationGoalId(otherGoalId)).resolves.toBe(otherGoal.id);
    await expect(getBuddyConversationGoalId(emptyId)).resolves.toBeNull();

    vi.setSystemTime(new Date("2030-01-02T08:00:00Z"));

    await expect(listBuddyConversations({ goalId: goal.id })).resolves.toMatchObject({
      currentId: null,
    });

    const otherUser = await userFixture();
    mockSession(otherUser.id);
    await expect(getBuddyConversationGoalId(latestId)).resolves.toBeNull();
  });
});
