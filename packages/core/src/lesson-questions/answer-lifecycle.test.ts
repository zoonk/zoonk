import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getGenerationQuotaRules } from "../generation-quotas/limits";
import { createLessonQuestionFixture } from "./_test-utils/create-question";
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

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

async function createFollowUpQuestion({
  lessonId,
  question,
}: {
  lessonId: string;
  question: string;
}) {
  const created = await createLessonQuestion({
    input: { context: { kind: "lesson" }, question, requestId: randomUUID() },
    lessonId,
  });

  if (created.status !== "created") {
    throw new Error(`Expected a created follow-up, received ${created.status}`);
  }

  return created.question;
}

async function setLessonQuestionDailyQuota({
  count,
  questionId,
}: {
  count: number;
  questionId: string;
}) {
  const claim = await prisma.generationQuotaClaim.findUniqueOrThrow({
    where: { generationQuotaClaim: { resource: "lessonQuestion", targetId: questionId } },
  });

  await prisma.generationQuotaCounter.updateMany({
    data: { count },
    where: { actorKey: claim.actorKey, period: "day", resource: "lessonQuestion" },
  });
}

describe("lesson question answer lifecycle", () => {
  beforeEach(() => {
    vi.mocked(headers).mockResolvedValue(new Headers());
    mockSession(null);
  });

  it("atomically claims generation and blocks duplicate claims", async () => {
    const { question } = await createLessonQuestionFixture();

    const [first, duplicate] = await Promise.all([
      claimLessonQuestionAnswer({ questionId: question.id, requestedModel: "openai/gpt-5.6-luna" }),
      claimLessonQuestionAnswer({ questionId: question.id, requestedModel: "openai/gpt-5.6-luna" }),
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
      requestedModel: "openai/gpt-5.6-luna",
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
      claimLessonQuestionAnswer({ questionId: question.id, requestedModel: "openai/gpt-5.6-luna" }),
      claimLessonQuestionAnswer({ questionId: followUp.id, requestedModel: "openai/gpt-5.6-luna" }),
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

  it("rechecks paid lesson access before starting answer generation", async () => {
    const { question, user } = await createLessonQuestionFixture({ chapterPosition: 1 });

    await prisma.subscription.updateMany({
      data: { status: "canceled" },
      where: { referenceId: user.id },
    });

    await expect(
      claimLessonQuestionAnswer({ questionId: question.id, requestedModel: "openai/gpt-5.6-luna" }),
    ).resolves.toStrictEqual({ status: "subscriptionRequired" });

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: question.id } }),
    ).resolves.toMatchObject({ generationRevision: 0, status: "pending" });
  });

  it("does not answer retained history after its lesson is removed", async () => {
    const { lesson, question } = await createLessonQuestionFixture();

    await prisma.lesson.delete({ where: { id: lesson.id } });

    await expect(
      claimLessonQuestionAnswer({ questionId: question.id, requestedModel: "openai/gpt-5.6-luna" }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: question.id } }),
    ).resolves.toMatchObject({ generationRevision: 0, status: "pending" });
  });

  it("uses the revision to prevent a stale generation from overwriting a retry", async () => {
    const { lesson, question } = await createLessonQuestionFixture();

    const firstClaim = await claimLessonQuestionAnswer({
      questionId: question.id,
      requestedModel: "openai/gpt-5.6-luna",
    });

    if (firstClaim.status !== "ready") {
      throw new Error(`Expected a ready claim, received ${firstClaim.status}`);
    }

    await expect(
      failLessonQuestionAnswer({ questionId: question.id, revision: firstClaim.claim.revision }),
    ).resolves.toStrictEqual({ status: "updated" });

    const retry = await claimLessonQuestionAnswer({
      questionId: question.id,
      requestedModel: "openai/gpt-5.6-luna",
    });

    if (retry.status !== "ready") {
      throw new Error(`Expected a ready retry, received ${retry.status}`);
    }

    expect(retry.claim.revision).toBe(2);

    const quotaClaim = await prisma.generationQuotaClaim.findUniqueOrThrow({
      where: { generationQuotaClaim: { resource: "lessonQuestion", targetId: question.id } },
    });

    const quotaCounters = await prisma.generationQuotaCounter.findMany({
      where: { actorKey: quotaClaim.actorKey, resource: "lessonQuestion" },
    });

    expect(quotaCounters).toHaveLength(2);
    expect(quotaCounters.every((counter) => counter.count === 1)).toBe(true);

    await expect(
      completeLessonQuestionAnswer({
        answer: "Stale answer",
        finishReason: "stop",
        inputTokens: 10,
        model: "openai/gpt-5.6-luna",
        outputTokens: 5,
        provider: "openai",
        questionId: question.id,
        revision: firstClaim.claim.revision,
        totalTokens: 15,
      }),
    ).resolves.toStrictEqual({ status: "stale" });

    await expect(
      completeLessonQuestionAnswer({
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
      generationRevision: 2,
      inputTokens: 12,
      model: "google/gemini-3.1-flash-lite",
      outputTokens: 6,
      provider: "google",
      status: "completed",
      totalTokens: 18,
    });

    const thread = await getLessonQuestionThread({ lessonId: lesson.id });

    expect(thread).toMatchObject({
      status: "ready",
      thread: {
        questions: [expect.objectContaining({ answer: "Current answer", status: "completed" })],
      },
    });
  });

  it("atomically reserves the last quota slot and releases the rejected question revision", async () => {
    const { chapter, organization, question, user } = await createLessonQuestionFixture();

    const seedClaim = await claimLessonQuestionAnswer({
      questionId: question.id,
      requestedModel: "openai/gpt-5.6-luna",
    });

    if (seedClaim.status !== "ready") {
      throw new Error(`Expected a ready quota seed, received ${seedClaim.status}`);
    }

    await failLessonQuestionAnswer({ questionId: question.id, revision: seedClaim.claim.revision });

    const dailyLimit = getGenerationQuotaRules({
      now: new Date(),
      resource: "lessonQuestion",
      viewer: "subscriber",
    }).find((rule) => rule.period === "day")?.limit;

    if (!dailyLimit) {
      throw new Error("Expected a subscriber daily lesson-question limit");
    }

    await setLessonQuestionDailyQuota({ count: dailyLimit - 1, questionId: question.id });

    const [firstLesson, secondLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 2,
      }),
    ]);

    const [firstQuestion, secondQuestion] = await Promise.all([
      createFollowUpQuestion({ lessonId: firstLesson.id, question: "What is the first example?" }),
      createFollowUpQuestion({
        lessonId: secondLesson.id,
        question: "What is the second example?",
      }),
    ]);

    const results = await Promise.all(
      [firstQuestion, secondQuestion].map((candidate) =>
        claimLessonQuestionAnswer({
          questionId: candidate.id,
          requestedModel: "openai/gpt-5.6-luna",
        }),
      ),
    );

    expect(results.map((result) => result.status).toSorted()).toStrictEqual([
      "limitReached",
      "ready",
    ]);

    const limitResult = results.find((result) => result.status === "limitReached");

    expect(limitResult).toMatchObject({
      actor: { distinctId: user.id, username: null },
      limit: { period: "day", resource: "lessonQuestion", viewer: "subscriber" },
      status: "limitReached",
    });

    const storedQuestions = await prisma.lessonQuestion.findMany({
      where: { id: { in: [firstQuestion.id, secondQuestion.id] } },
    });

    for (const [index, result] of results.entries()) {
      const candidate = [firstQuestion, secondQuestion][index];
      const stored = storedQuestions.find((item) => item.id === candidate?.id);

      expect(stored).toMatchObject({
        generationRevision: 1,
        status: result.status === "ready" ? "running" : "failed",
      });
    }

    await expect(
      prisma.generationQuotaCounter.findFirstOrThrow({
        where: { actorKey: `user:${user.id}`, period: "day", resource: "lessonQuestion" },
      }),
    ).resolves.toMatchObject({ count: dailyLimit });
  });

  it("supplies only earlier completed turns as generation history", async () => {
    const { lesson, question } = await createLessonQuestionFixture();

    const firstClaim = await claimLessonQuestionAnswer({
      questionId: question.id,
      requestedModel: "openai/gpt-5.6-luna",
    });

    if (firstClaim.status !== "ready") {
      throw new Error(`Expected a ready claim, received ${firstClaim.status}`);
    }

    await completeLessonQuestionAnswer({
      answer: "It builds on the earlier example.",
      finishReason: "stop",
      model: "openai/gpt-5.6-luna",
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
      lessonId: lesson.id,
    });

    if (followUp.status !== "created") {
      throw new Error(`Expected a created follow-up, received ${followUp.status}`);
    }

    const followUpClaim = await claimLessonQuestionAnswer({
      questionId: followUp.question.id,
      requestedModel: "openai/gpt-5.6-luna",
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
      requestedModel: "openai/gpt-5.6-luna",
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
      claimLessonQuestionAnswer({ questionId: question.id, requestedModel: "openai/gpt-5.6-luna" }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      completeLessonQuestionAnswer({
        answer: "Not yours",
        finishReason: "stop",
        model: "openai/gpt-5.6-luna",
        provider: "openai",
        questionId: question.id,
        revision: 1,
      }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
