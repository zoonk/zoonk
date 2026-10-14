import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it, vi } from "vitest";
import { holdTransaction, waitForBlocked } from "./_test-utils/blocked-sessions";
import {
  createExistingAccount,
  createTestEmail,
  signInAsGuest,
  signInWithPassword,
  signUp,
} from "./_test-utils/guest-auth";
import { createGoal, createLesson } from "./_test-utils/learner-data";

/** BotID only classifies requests on Vercel, so tests stand in for its verdict. */
vi.mock("botid/server", () => ({ checkBotId: vi.fn().mockResolvedValue({ isBot: false }) }));

const OLDER = new Date("2026-09-01T00:00:00Z");
const NEWER = new Date("2026-09-02T00:00:00Z");
const NEWEST = new Date("2026-09-03T00:00:00Z");

/** A turn with the tutor, answered from the screen's shared answer like a guest's can be. */
function askTutor({
  createdAt,
  question,
  requestId = randomUUID(),
  threadId,
}: {
  createdAt: Date;
  question: string;
  requestId?: string;
  threadId: string;
}) {
  return prisma.lessonQuestion.create({
    data: {
      answer: `About: ${question}`,
      contextKind: "lesson",
      contextSnapshot: {},
      createdAt,
      question,
      requestFingerprint: `fingerprint:${question}`,
      requestId,
      status: "completed",
      threadId,
      updatedAt: createdAt,
    },
  });
}

describe("guest tutor link", () => {
  it("moves a guest's tutor threads to the new account with every question as it was", async () => {
    const [{ guestId, headers }, lesson] = await Promise.all([signInAsGuest(), createLesson()]);
    const goal = await createGoal(guestId);

    const [lessonThread, planThread] = await Promise.all([
      prisma.lessonQuestionThread.create({
        data: { kind: "lesson", libraryLessonId: lesson.id, userId: guestId },
      }),
      prisma.lessonQuestionThread.create({
        data: { goalId: goal.id, kind: "plan", userId: guestId },
      }),
    ]);

    const questions = await Promise.all([
      askTutor({ createdAt: OLDER, question: "Why green?", threadId: lessonThread.id }),
      askTutor({ createdAt: NEWER, question: "And at night?", threadId: lessonThread.id }),
      askTutor({ createdAt: OLDER, question: "Is my plan too long?", threadId: planThread.id }),
    ]);

    const { userId } = await signUp({ email: createTestEmail(), headers });

    await expect(prisma.user.findUnique({ where: { id: guestId } })).resolves.toBeNull();

    const threads = await prisma.lessonQuestionThread.findMany({
      orderBy: { id: "asc" },
      where: { userId },
    });

    expect(threads.map((thread) => thread.id)).toStrictEqual(
      [lessonThread.id, planThread.id].toSorted(),
    );

    const moved = await prisma.lessonQuestion.findMany({
      where: { id: { in: questions.map((question) => question.id) } },
    });

    expect(moved).toHaveLength(questions.length);

    for (const question of questions) {
      expect(moved).toContainEqual(question);
    }
  });

  it("joins a guest's thread to the account's about the same lesson, keeping both histories", async () => {
    const [account, guest, lesson] = await Promise.all([
      createExistingAccount({ createdAt: OLDER }),
      signInAsGuest(),
      createLesson(),
    ]);

    const [accountThread, guestThread] = await Promise.all([
      prisma.lessonQuestionThread.create({
        data: {
          createdAt: NEWER,
          kind: "lesson",
          libraryLessonId: lesson.id,
          updatedAt: NEWER,
          userId: account.userId,
        },
      }),
      prisma.lessonQuestionThread.create({
        data: {
          createdAt: OLDER,
          kind: "lesson",
          libraryLessonId: lesson.id,
          updatedAt: NEWEST,
          userId: guest.guestId,
        },
      }),
    ]);

    // The same client retried one request as the guest and as the account: both turns stay.
    const sharedRequestId = randomUUID();

    const [accountQuestion, guestQuestion, guestRetry] = await Promise.all([
      askTutor({
        createdAt: NEWER,
        question: "Asked on the account",
        requestId: sharedRequestId,
        threadId: accountThread.id,
      }),
      askTutor({ createdAt: OLDER, question: "Asked as a guest", threadId: guestThread.id }),
      askTutor({
        createdAt: NEWEST,
        question: "Asked as a guest with the account's request",
        requestId: sharedRequestId,
        threadId: guestThread.id,
      }),
    ]);

    await signInWithPassword({ email: account.email, headers: guest.headers });

    await expect(prisma.user.findUnique({ where: { id: guest.guestId } })).resolves.toBeNull();

    const threads = await prisma.lessonQuestionThread.findMany({
      include: { questions: { orderBy: { createdAt: "asc" } } },
      where: { libraryLessonId: lesson.id },
    });

    expect(threads).toHaveLength(1);
    const [thread] = threads;

    expect(thread).toMatchObject({
      createdAt: OLDER,
      id: accountThread.id,
      updatedAt: NEWEST,
      userId: account.userId,
    });

    expect(thread?.questions.map((question) => question.id)).toStrictEqual([
      guestQuestion.id,
      accountQuestion.id,
      guestRetry.id,
    ]);

    const [movedGuestQuestion, keptAccountQuestion, movedRetry] = thread?.questions ?? [];

    expect(movedGuestQuestion).toStrictEqual({ ...guestQuestion, threadId: accountThread.id });
    expect(keptAccountQuestion).toStrictEqual(accountQuestion);

    // Only the request id changes: it dedupes one client's retries, and the account kept its own.
    expect(movedRetry?.requestId).not.toBe(sharedRequestId);

    expect(movedRetry).toStrictEqual({
      ...guestRetry,
      requestId: movedRetry?.requestId,
      threadId: accountThread.id,
    });
  });

  it("joins a thread the account starts about the same lesson while the guest's moves", async () => {
    const [account, guest, lesson] = await Promise.all([
      createExistingAccount({ createdAt: OLDER }),
      signInAsGuest(),
      createLesson(),
    ]);

    const guestThread = await prisma.lessonQuestionThread.create({
      data: { kind: "lesson", libraryLessonId: lesson.id, userId: guest.guestId },
    });

    const guestQuestion = await askTutor({
      createdAt: OLDER,
      question: "Asked as a guest",
      threadId: guestThread.id,
    });

    // The account asks about the same lesson elsewhere, still uncommitted when the move reaches it.
    const asking = await holdTransaction(async (transaction) => {
      const thread = await transaction.lessonQuestionThread.create({
        data: { kind: "lesson", libraryLessonId: lesson.id, userId: account.userId },
      });

      await transaction.lessonQuestion.create({
        data: {
          contextKind: "lesson",
          contextSnapshot: {},
          question: "Asked on the account",
          requestFingerprint: "fingerprint:account",
          requestId: randomUUID(),
          threadId: thread.id,
        },
      });

      return thread;
    });

    const linking = signInWithPassword({ email: account.email, headers: guest.headers });

    try {
      await waitForBlocked({ blocker: asking.blocker, count: 1 });
    } finally {
      asking.release();
    }

    const accountThread = await asking.held;
    await linking;

    const threads = await prisma.lessonQuestionThread.findMany({
      include: { questions: { orderBy: { createdAt: "asc" } } },
      where: { libraryLessonId: lesson.id },
    });

    expect(threads).toHaveLength(1);
    expect(threads[0]?.id).toBe(accountThread.id);
    expect(threads[0]?.questions).toHaveLength(2);

    expect(threads[0]?.questions[0]).toStrictEqual({
      ...guestQuestion,
      threadId: accountThread.id,
    });
  });
});
