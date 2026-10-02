import { randomUUID } from "node:crypto";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { updateMemoryFromActivity } from "../memory/update-memory-from-activity";
import { createLessonQuestionFixture } from "./_test-utils/create-question";
import { mockQuestionGenerality } from "./_test-utils/question-generality";
import {
  parseLessonQuestionContextSnapshot,
  toDatabaseLessonQuestionContextSnapshot,
} from "./_utils/context-snapshot-schema";
import {
  claimLessonQuestionAnswer,
  completeLessonQuestionAnswer,
  failLessonQuestionAnswer,
} from "./answer-lifecycle";
import { createLessonQuestion } from "./create-lesson-question";
import { getLessonQuestionThread } from "./get-lesson-question-thread";
import type * as RateLimit from "@zoonk/auth/rate-limit";

/** The run that wrote a test answer, as the answers route passes it from the task's provenance. */
const ANSWER_RUN = {
  generatedAt: "2026-09-27T12:00:00.000Z",
  promptVersion: "lesson-question-test",
  runId: "run-lesson-question-test",
};

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

/** The generality check calls a model; each test says whether its question is general. */
vi.mock("@zoonk/ai/tasks/v2/explain/question-generality", () => ({
  classifyQuestionGenerality: vi.fn(),
}));

/** Memory extraction calls a model; the memory module's own tests cover what it learns. */
vi.mock("../memory/update-memory-from-activity", () => ({ updateMemoryFromActivity: vi.fn() }));

async function createFollowUpQuestion({
  lessonId,
  question,
}: {
  lessonId: string;
  question: string;
}) {
  const created = await createLessonQuestion({
    input: { context: { kind: "lesson" }, question, requestId: randomUUID() },
    target: { kind: "lesson", lessonId },
  });

  if (created.status !== "created") {
    throw new Error(`Expected a created follow-up, received ${created.status}`);
  }

  return created.question;
}

describe("lesson question answer lifecycle", () => {
  beforeEach(() => {
    vi.mocked(isRateLimited).mockResolvedValue(false);
    vi.mocked(updateMemoryFromActivity).mockResolvedValue([]);
    mockQuestionGenerality(false);
    mockSession(null);
  });

  it("isolates generation and follow-up history by step", async () => {
    const { lesson, question, steps } = await createLessonQuestionFixture({
      steps: ["explanation", "workedExample"],
    });

    await prisma.lessonQuestion.update({
      data: { answer: "Lesson summary", status: "completed" },
      where: { id: question.id },
    });

    const created = await Promise.all(
      steps.map((step) =>
        createLessonQuestion({
          input: {
            context: { kind: "step", stepId: step.id, stepNumber: step.position + 1 },
            question: `Explain step ${step.position}`,
            requestId: randomUUID(),
          },
          target: { kind: "lesson", lessonId: lesson.id },
        }),
      ),
    );

    const [first, second] = created;

    if (first?.status !== "created" || second?.status !== "created") {
      throw new Error("Expected both step questions");
    }

    const claims = await Promise.all(
      [first, second].map((result) =>
        claimLessonQuestionAnswer({
          questionId: result.question.id,
          requestedModel: "openai/gpt-6-luna",
        }),
      ),
    );

    expect(claims).toMatchObject([
      { claim: { priorTurns: [] }, status: "ready" },
      { claim: { priorTurns: [] }, status: "ready" },
    ]);

    await prisma.lessonQuestion.update({
      data: { answer: "First step explanation", status: "completed" },
      where: { id: first.question.id },
    });

    const firstStep = steps[0];

    if (!firstStep) {
      throw new Error("Expected the first step");
    }

    const followUp = await createLessonQuestion({
      input: {
        context: { kind: "step", stepId: firstStep.id, stepNumber: 1 },
        question: "Can you give an example?",
        requestId: randomUUID(),
      },
      target: { kind: "lesson", lessonId: lesson.id },
    });

    if (followUp.status !== "created") {
      throw new Error("Expected a follow-up");
    }

    await expect(
      claimLessonQuestionAnswer({
        questionId: followUp.question.id,
        requestedModel: "openai/gpt-6-luna",
      }),
    ).resolves.toMatchObject({
      claim: {
        priorTurns: [{ answer: "First step explanation", question: first.question.question }],
      },
      status: "ready",
    });
  });

  it("atomically claims generation and blocks duplicate claims", async () => {
    const { question } = await createLessonQuestionFixture();

    const [first, duplicate] = await Promise.all([
      claimLessonQuestionAnswer({ questionId: question.id, requestedModel: "openai/gpt-6-luna" }),
      claimLessonQuestionAnswer({ questionId: question.id, requestedModel: "openai/gpt-6-luna" }),
    ]);

    expect([first.status, duplicate.status].toSorted()).toStrictEqual(["conflict", "ready"]);

    const ready = first.status === "ready" ? first : duplicate;

    if (ready.status !== "ready") {
      throw new Error("Expected one answer claim");
    }

    expect(ready.claim).toMatchObject({
      priorTurns: [],
      question: "How does this connect?",
      questionId: question.id,
      revision: 1,
    });

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: question.id } }),
    ).resolves.toMatchObject({
      generationRevision: 1,
      requestedModel: "openai/gpt-6-luna",
      status: "running",
    });
  });

  it("allows only the earliest unfinished turn to claim generation", async () => {
    const { lesson, question } = await createLessonQuestionFixture();

    await prisma.lessonQuestion.update({
      data: { answer: "Temporary completed answer", status: "completed" },
      where: { id: question.id },
    });

    const followUp = await createFollowUpQuestion({
      lessonId: lesson.id,
      question: "Can we go deeper?",
    });

    await prisma.lessonQuestion.update({
      data: { answer: null, status: "pending" },
      where: { id: question.id },
    });

    const [first, second] = await Promise.all([
      claimLessonQuestionAnswer({ questionId: question.id, requestedModel: "openai/gpt-6-luna" }),
      claimLessonQuestionAnswer({ questionId: followUp.id, requestedModel: "openai/gpt-6-luna" }),
    ]);

    expect(first.status).toBe("ready");
    expect(second).toStrictEqual({ status: "conflict" });

    await expect(
      prisma.lessonQuestion.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        where: { id: { in: [question.id, followUp.id] } },
      }),
    ).resolves.toMatchObject([{ status: "running" }, { status: "pending" }]);
  });

  it("does not answer retained history after its lesson is removed", async () => {
    const { lesson, question } = await createLessonQuestionFixture();

    await prisma.lesson.delete({ where: { id: lesson.id } });

    await expect(
      claimLessonQuestionAnswer({ questionId: question.id, requestedModel: "openai/gpt-6-luna" }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: question.id } }),
    ).resolves.toMatchObject({ generationRevision: 0, status: "pending" });
  });

  it.each(["failed", "abandoned"])("safely retries a %s answer", async (cause) => {
    const { lesson, question, user } = await createLessonQuestionFixture();

    const firstClaim = await claimLessonQuestionAnswer({
      questionId: question.id,
      requestedModel: "openai/gpt-6-luna",
    });

    if (firstClaim.status !== "ready") {
      throw new Error(`Expected a ready claim, received ${firstClaim.status}`);
    }

    if (cause === "abandoned") {
      await prisma.lessonQuestion.update({
        data: { updatedAt: new Date(Date.now() - 180_000) },
        where: { id: question.id },
      });
    } else {
      await failLessonQuestionAnswer({
        questionId: question.id,
        revision: firstClaim.claim.revision,
      });
    }

    const retry = await claimLessonQuestionAnswer({
      questionId: question.id,
      requestedModel: "openai/gpt-6-luna",
    });

    if (retry.status !== "ready") {
      throw new Error(`Expected a ready retry, received ${retry.status}`);
    }

    expect(retry.claim.revision).toBe(2);

    // A retry answers the same message, so the tutor allowance counts it once.
    await expect(
      prisma.usageRecord.count({
        where: { kind: "tutorMessage", targetId: question.id, userId: user.id },
      }),
    ).resolves.toBe(1);

    await expect(
      completeLessonQuestionAnswer({
        ...ANSWER_RUN,
        answer: "Stale answer",
        finishReason: "stop",
        inputTokens: 10,
        model: "openai/gpt-6-luna",
        outputTokens: 5,
        provider: "openai",
        questionId: question.id,
        revision: firstClaim.claim.revision,
        totalTokens: 15,
      }),
    ).resolves.toStrictEqual({ status: "stale" });

    await expect(
      completeLessonQuestionAnswer({
        ...ANSWER_RUN,
        answer: "Current answer",
        finishReason: "stop",
        inputTokens: 12,
        model: "google/gemini-3.1-flash-lite",
        outputTokens: 6,
        provider: "google",
        questionId: question.id,
        revision: retry.claim.revision,
        totalTokens: 18,
      }),
    ).resolves.toStrictEqual({ status: "updated" });

    const stored = await prisma.lessonQuestion.findUniqueOrThrow({ where: { id: question.id } });

    expect(stored).toMatchObject({
      answer: "Current answer",
      finishReason: "stop",
      generatedAt: new Date(ANSWER_RUN.generatedAt),
      generationRevision: 2,
      inputTokens: 12,
      model: "google/gemini-3.1-flash-lite",
      outputTokens: 6,
      promptVersion: ANSWER_RUN.promptVersion,
      provider: "google",
      runId: ANSWER_RUN.runId,
      status: "completed",
      totalTokens: 18,
    });

    const thread = await getLessonQuestionThread({
      target: { kind: "lesson", lessonId: lesson.id },
    });

    expect(thread).toMatchObject({
      status: "ready",
      thread: {
        questions: [expect.objectContaining({ answer: "Current answer", status: "completed" })],
      },
    });
  });

  it("supplies only earlier completed turns as generation history", async () => {
    const { lesson, question } = await createLessonQuestionFixture();

    const firstClaim = await claimLessonQuestionAnswer({
      questionId: question.id,
      requestedModel: "openai/gpt-6-luna",
    });

    if (firstClaim.status !== "ready") {
      throw new Error(`Expected a ready claim, received ${firstClaim.status}`);
    }

    await completeLessonQuestionAnswer({
      ...ANSWER_RUN,
      answer: "It builds on the earlier example.",
      finishReason: "stop",
      model: "openai/gpt-6-luna",
      provider: "openai",
      questionId: question.id,
      revision: firstClaim.claim.revision,
    });

    const followUp = await createLessonQuestion({
      input: {
        context: { kind: "lesson" },
        question: "Can you give me another example?",
        requestId: randomUUID(),
      },
      target: { kind: "lesson", lessonId: lesson.id },
    });

    if (followUp.status !== "created") {
      throw new Error(`Expected a created follow-up, received ${followUp.status}`);
    }

    const followUpClaim = await claimLessonQuestionAnswer({
      questionId: followUp.question.id,
      requestedModel: "openai/gpt-6-luna",
    });

    expect(followUpClaim).toMatchObject({
      claim: {
        priorTurns: [
          { answer: "It builds on the earlier example.", question: "How does this connect?" },
        ],
      },
      status: "ready",
    });
  });

  it("limits generation history to the latest twelve completed turns", async () => {
    const { lesson, question } = await createLessonQuestionFixture();

    const storedQuestion = await prisma.lessonQuestion.findUniqueOrThrow({
      where: { id: question.id },
    });

    const contextSnapshot = toDatabaseLessonQuestionContextSnapshot(
      parseLessonQuestionContextSnapshot(storedQuestion.contextSnapshot),
    );

    const firstCreatedAt = new Date("2026-01-01T00:00:00.000Z");

    await prisma.$transaction([
      prisma.lessonQuestion.update({
        data: {
          answer: "Answer 1",
          createdAt: firstCreatedAt,
          status: "completed",
          updatedAt: firstCreatedAt,
        },
        where: { id: question.id },
      }),
      prisma.lessonQuestion.createMany({
        data: Array.from({ length: 14 }, (_, index) => {
          const questionNumber = index + 2;
          const createdAt = new Date(firstCreatedAt.getTime() + questionNumber * 1000);

          return {
            answer: `Answer ${questionNumber}`,
            contextKind: "lesson" as const,
            contextSnapshot,
            createdAt,
            question: `Question ${questionNumber}`,
            requestFingerprint: `prior-turn-${questionNumber}`,
            requestId: randomUUID(),
            status: "completed" as const,
            threadId: storedQuestion.threadId,
            updatedAt: createdAt,
          };
        }),
      }),
    ]);

    const followUp = await createFollowUpQuestion({ lessonId: lesson.id, question: "Question 16" });

    const claim = await claimLessonQuestionAnswer({
      questionId: followUp.id,
      requestedModel: "openai/gpt-6-luna",
    });

    if (claim.status !== "ready") {
      throw new Error(`Expected a ready claim, received ${claim.status}`);
    }

    expect(claim.claim.priorTurns).toStrictEqual(
      Array.from({ length: 12 }, (_, index) => {
        const questionNumber = index + 4;
        return { answer: `Answer ${questionNumber}`, question: `Question ${questionNumber}` };
      }),
    );
  });

  it("never lets another learner claim or finish the question", async () => {
    const { question } = await createLessonQuestionFixture();
    const otherUser = await userFixture();
    mockSession(otherUser.id);

    await expect(
      claimLessonQuestionAnswer({ questionId: question.id, requestedModel: "openai/gpt-6-luna" }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      completeLessonQuestionAnswer({
        ...ANSWER_RUN,
        answer: "Not yours",
        finishReason: "stop",
        model: "openai/gpt-6-luna",
        provider: "openai",
        questionId: question.id,
        revision: 1,
      }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
