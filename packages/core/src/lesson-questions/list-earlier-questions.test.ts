import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { hasEarlierQuestions, listEarlierQuestions } from "./list-earlier-questions";

/** How many questions one page of the history holds. */
const PAGE_SIZE = 50;

/** What a lesson question saved before the Library looked like: the lesson it was about is gone. */
const EARLIER_SNAPSHOT = {
  course: { title: "Physics" },
  lesson: { title: "Newton's laws" },
  version: 1,
};

async function askedQuestion({
  answer = "Because forces come in pairs.",
  createdAt,
  goalId = null,
  question,
  snapshot = EARLIER_SNAPSHOT,
  userId,
}: {
  answer?: string | null;
  createdAt: Date;
  goalId?: string | null;
  question: string;
  snapshot?: object;
  userId: string;
}) {
  const thread = await prisma.lessonQuestionThread.create({
    data: { goalId, kind: goalId ? "plan" : "lesson", userId },
  });

  return prisma.lessonQuestion.create({
    data: {
      answer,
      contextKind: goalId ? "plan" : "lesson",
      contextSnapshot: snapshot,
      createdAt,
      question,
      requestFingerprint: randomUUID(),
      requestId: randomUUID(),
      status: answer ? "completed" : "failed",
      threadId: thread.id,
    },
  });
}

describe(listEarlierQuestions, () => {
  // A learner's questions from before the Library lost the lessons they were about; hiding them
  // would read as their history being deleted.
  it("keeps a learner's questions whose lessons are gone, newest first, with the course they were in", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);
    const goal = await goalFixture({ userId: user.id });

    const [older, newer] = await Promise.all([
      askedQuestion({
        createdAt: new Date("2026-03-01T10:00:00Z"),
        question: "Why does the cart move back?",
        userId: user.id,
      }),
      askedQuestion({
        answer: null,
        createdAt: new Date("2026-04-01T10:00:00Z"),
        question: "What is inertia?",
        snapshot: { version: 1 },
        userId: user.id,
      }),
      // Their buddy conversation still has its goal, and someone else's history isn't theirs.
      askedQuestion({
        createdAt: new Date("2026-05-01T10:00:00Z"),
        goalId: goal.id,
        question: "Can I study less this week?",
        userId: user.id,
      }),
      askedQuestion({
        createdAt: new Date("2026-05-01T10:00:00Z"),
        question: "Someone else's question",
        userId: other.id,
      }),
    ]);

    mockSession(user.id);

    await expect(hasEarlierQuestions()).resolves.toBe(true);

    await expect(listEarlierQuestions()).resolves.toStrictEqual({
      nextCursor: null,
      questions: [
        {
          answer: null,
          askedAt: "2026-04-01T10:00:00.000Z",
          courseTitle: null,
          id: newer.id,
          lessonTitle: null,
          question: "What is inertia?",
        },
        {
          answer: "Because forces come in pairs.",
          askedAt: "2026-03-01T10:00:00.000Z",
          courseTitle: "Physics",
          id: older.id,
          lessonTitle: "Newton's laws",
          question: "Why does the cart move back?",
        },
      ],
      status: "ready",
    });
  });

  it("has nothing for a learner who only asked in today's lessons", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await expect(hasEarlierQuestions()).resolves.toBe(false);

    await expect(listEarlierQuestions()).resolves.toStrictEqual({
      nextCursor: null,
      questions: [],
      status: "ready",
    });
  });

  // A learner who asked a lot before the rewrite would otherwise lose everything past one read.
  it("pages through a long history, oldest last", async () => {
    const user = await userFixture();
    const start = Date.parse("2026-01-01T00:00:00Z");

    await Promise.all(
      Array.from({ length: PAGE_SIZE + 1 }, (_, index) =>
        askedQuestion({
          createdAt: new Date(start + index * 60_000),
          question: `Question ${index + 1}`,
          userId: user.id,
        }),
      ),
    );

    mockSession(user.id);

    const first = await listEarlierQuestions();
    const firstPage = first.status === "ready" ? first : null;

    expect(firstPage?.questions).toHaveLength(PAGE_SIZE);
    expect(firstPage?.questions[0]?.question).toBe(`Question ${PAGE_SIZE + 1}`);

    await expect(
      listEarlierQuestions({ cursor: firstPage?.nextCursor ?? "" }),
    ).resolves.toMatchObject({
      nextCursor: null,
      questions: [{ question: "Question 1" }],
      status: "ready",
    });

    await expect(listEarlierQuestions({ cursor: randomUUID() })).resolves.toStrictEqual({
      status: "invalidCursor",
    });
  });

  it("needs a session", async () => {
    mockSession(null);

    await expect(hasEarlierQuestions()).resolves.toBe(false);
    await expect(listEarlierQuestions()).resolves.toStrictEqual({ status: "unauthorized" });
  });
});
