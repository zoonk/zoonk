import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { trackServerEvent } from "../analytics/server";
import {
  parseLessonQuestionContextSnapshot,
  toDatabaseLessonQuestionContextSnapshot,
} from "./_utils/context-snapshot-schema";
import { type LessonQuestionContextInput, createLessonQuestionInputSchema } from "./contract";
import { createLessonQuestion } from "./create-lesson-question";
import { getLessonQuestionThread } from "./get-lesson-question-thread";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

type LessonSteps = NonNullable<Parameters<typeof playableLessonFixture>[0]>["steps"];

/** A learner and a written Library lesson, without signing the learner in. */
async function createLesson(steps?: LessonSteps) {
  const [user, { lesson, steps: lessonSteps }] = await Promise.all([
    userFixture(),
    playableLessonFixture({ lesson: { title: "Electron clouds" }, steps }),
  ]);

  return { lesson, steps: lessonSteps, user };
}

async function ask({
  context,
  lessonId,
  question = "Can you summarize this?",
}: {
  context: LessonQuestionContextInput;
  lessonId: string;
  question?: string;
}) {
  const created = await createLessonQuestion({
    input: { context, question, requestId: randomUUID() },
    target: { kind: "lesson", lessonId },
  });

  if (created.status !== "created") {
    throw new Error(`Expected a created question, received ${created.status}`);
  }

  return created.question;
}

function explanationSteps(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    content: { text: `Lesson content ${index + 1}`, title: `Topic ${index + 1}` },
    kind: "explanation" as const,
  }));
}

describe(createLessonQuestion, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it.each([true, false])(
    "preserves the full content of a long lesson (explicit step IDs: %s)",
    async (withStepIds) => {
      const contents = explanationSteps(51);
      const { lesson, steps, user } = await createLesson(contents);
      mockSession(user.id);

      const orderedSteps = withStepIds ? steps.toReversed() : steps;

      const input = createLessonQuestionInputSchema.parse({
        context: withStepIds
          ? { kind: "lesson", stepIds: orderedSteps.map((step) => step.id) }
          : { kind: "lesson" },
        question: "How does the last topic connect to the first?",
        requestId: randomUUID(),
      });

      const result = await createLessonQuestion({
        input,
        target: { kind: "lesson", lessonId: lesson.id },
      });

      if (result.status !== "created") {
        throw new Error(`Expected a created question, received ${result.status}`);
      }

      const stored = await prisma.lessonQuestion.findUniqueOrThrow({
        where: { id: result.question.id },
      });

      expect(parseLessonQuestionContextSnapshot(stored.contextSnapshot)).toMatchObject({
        lessonSteps: orderedSteps.map((step) => ({ content: step.content })),
      });
    },
  );

  it("does not create question history for a guest", async () => {
    const { lesson } = await createLesson();

    const result = await createLessonQuestion({
      input: {
        context: { kind: "lesson" },
        question: "Can you summarize this?",
        requestId: randomUUID(),
      },
      target: { kind: "lesson", lessonId: lesson.id },
    });

    expect(result).toStrictEqual({ status: "unauthorized" });

    await expect(
      prisma.lessonQuestionThread.count({ where: { libraryLessonId: lesson.id } }),
    ).resolves.toBe(0);
  });

  it("returns one durable question for concurrent request replays", async () => {
    const { lesson, user } = await createLesson();

    const input = {
      context: { kind: "lesson" as const },
      question: "Can you summarize this?",
      requestId: randomUUID(),
    };

    mockSession(user.id);
    const flush = runDeferredWork();

    const [first, replay] = await Promise.all([
      createLessonQuestion({ input, target: { kind: "lesson", lessonId: lesson.id } }),
      createLessonQuestion({ input, target: { kind: "lesson", lessonId: lesson.id } }),
    ]);

    await createLessonQuestion({ input, target: { kind: "lesson", lessonId: lesson.id } });
    await flush();

    // Asked once, however often the request is replayed.
    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Tutor Asked",
        properties: { lesson_id: lesson.id, scope: "lesson" },
      }),
    );

    if (first.status !== "created" || replay.status !== "created") {
      throw new Error("Expected both request replays to resolve the durable question");
    }

    expect(replay.question).toStrictEqual(first.question);

    await expect(
      prisma.lessonQuestion.count({
        where: { thread: { libraryLessonId: lesson.id, userId: user.id } },
      }),
    ).resolves.toBe(1);
  });

  it("atomically rejects a second unfinished turn", async () => {
    const { lesson, user } = await createLesson();
    mockSession(user.id);

    const create = (question: string) =>
      createLessonQuestion({
        input: { context: { kind: "lesson" }, question, requestId: randomUUID() },
        target: { kind: "lesson", lessonId: lesson.id },
      });

    const [first, second] = await Promise.all([
      create("What is the first example?"),
      create("What is the second example?"),
    ]);

    expect([first.status, second.status].toSorted()).toStrictEqual(["conflict", "created"]);

    await expect(
      prisma.lessonQuestion.count({
        where: { thread: { libraryLessonId: lesson.id, userId: user.id } },
      }),
    ).resolves.toBe(1);
  });

  it("rejects request ID reuse with a different selected answer", async () => {
    const { lesson, steps, user } = await createLesson(["check"]);
    const [check] = steps;

    if (!check) {
      throw new Error("Expected the check step");
    }

    const requestId = randomUUID();
    mockSession(user.id);

    const answerWith = (optionId: string) =>
      createLessonQuestion({
        input: {
          context: {
            answer: { kind: "check", optionId },
            kind: "answer",
            stepId: check.id,
            stepNumber: 1,
          },
          question: "Why was my answer wrong?",
          requestId,
        },
        target: { kind: "lesson", lessonId: lesson.id },
      });

    const first = await answerWith("path");
    const conflict = await answerWith("size");

    expect(first.status).toBe("created");
    expect(conflict).toStrictEqual({ status: "conflict" });

    await expect(
      prisma.lessonQuestion.count({
        where: { thread: { libraryLessonId: lesson.id, userId: user.id } },
      }),
    ).resolves.toBe(1);
  });

  it("numbers lesson context in the learner's requested display order", async () => {
    const { lesson, steps, user } = await createLesson(explanationSteps(2));
    const [firstStep, secondStep] = steps;

    if (!firstStep || !secondStep) {
      throw new Error("Expected two steps");
    }

    mockSession(user.id);

    const question = await ask({
      context: { kind: "lesson", stepIds: [secondStep.id, firstStep.id] },
      lessonId: lesson.id,
      question: "How do these ideas connect?",
    });

    const stored = await prisma.lessonQuestion.findUniqueOrThrow({ where: { id: question.id } });

    expect(stored.contextSnapshot).toMatchObject({
      lessonSteps: [
        { content: secondStep.content, stepNumber: 1 },
        { content: firstStep.content, stepNumber: 2 },
      ],
    });
  });

  it("preserves questions and snapshots when their curriculum rows are deleted", async () => {
    const { lesson, steps, user } = await createLesson(["check"]);
    const [check] = steps;

    if (!check) {
      throw new Error("Expected the check step");
    }

    mockSession(user.id);

    const created = await ask({
      context: { kind: "step", stepId: check.id, stepNumber: 1 },
      lessonId: lesson.id,
      question: "Keep this context for my history",
    });

    await prisma.lesson.delete({ where: { id: lesson.id } });

    const question = await prisma.lessonQuestion.findUniqueOrThrow({
      include: { thread: true },
      where: { id: created.id },
    });

    expect({
      lessonId: question.thread.libraryLessonId,
      stepId: question.libraryStepId,
    }).toStrictEqual({ lessonId: null, stepId: null });

    expect(question.contextSnapshot).toMatchObject({
      lesson: { title: "Electron clouds" },
      step: { content: playableStepContent.check },
    });
  });
});

describe(getLessonQuestionThread, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("returns null before the learner asks a question", async () => {
    const { lesson, user } = await createLesson();
    mockSession(user.id);

    await expect(
      getLessonQuestionThread({ target: { kind: "lesson", lessonId: lesson.id } }),
    ).resolves.toStrictEqual({ status: "ready", thread: null });
  });

  it("does not expose another learner's thread", async () => {
    const [{ lesson, user }, otherUser] = await Promise.all([createLesson(), userFixture()]);
    mockSession(user.id);

    const privateQuestion = await ask({
      context: { kind: "lesson" },
      lessonId: lesson.id,
      question: "Private learner question",
    });

    mockSession(otherUser.id);

    await expect(
      getLessonQuestionThread({ target: { kind: "lesson", lessonId: lesson.id } }),
    ).resolves.toStrictEqual({ status: "ready", thread: null });

    await expect(
      getLessonQuestionThread({
        cursor: privateQuestion.id,
        target: { kind: "lesson", lessonId: lesson.id },
      }),
    ).resolves.toStrictEqual({ status: "invalidCursor" });
  });

  it("filters step and answer questions before pagination and rejects another step's cursor", async () => {
    const { lesson, steps, user } = await createLesson(explanationSteps(2));
    const [firstStep, secondStep] = steps;

    if (!firstStep || !secondStep) {
      throw new Error("Expected two steps");
    }

    mockSession(user.id);

    const created = await ask({
      context: { kind: "step", stepId: firstStep.id, stepNumber: 1 },
      lessonId: lesson.id,
      question: "First step question",
    });

    const source = await prisma.lessonQuestion.findUniqueOrThrow({ where: { id: created.id } });

    const contextSnapshot = toDatabaseLessonQuestionContextSnapshot(
      parseLessonQuestionContextSnapshot(source.contextSnapshot),
    );

    await prisma.lessonQuestion.createMany({
      data: Array.from({ length: 55 }, (_, index) => ({
        contextKind: "step",
        contextSnapshot,
        libraryStepId: secondStep.id,
        question: `Other step ${index}`,
        requestFingerprint: `other-${index}`,
        requestId: randomUUID(),
        stepNumber: 2,
        threadId: source.threadId,
      })),
    });

    const explanation = await prisma.lessonQuestion.create({
      data: {
        contextKind: "answer",
        contextSnapshot,
        libraryStepId: firstStep.id,
        question: "Explain my answer",
        requestFingerprint: "explanation",
        requestId: randomUUID(),
        stepNumber: 1,
        threadId: source.threadId,
      },
    });

    await expect(
      getLessonQuestionThread({
        stepId: firstStep.id,
        target: { kind: "lesson", lessonId: lesson.id },
      }),
    ).resolves.toMatchObject({
      status: "ready",
      thread: {
        hasMore: false,
        nextCursor: null,
        questions: [{ id: source.id }, { id: explanation.id }],
      },
    });

    await expect(
      getLessonQuestionThread({
        cursor: source.id,
        stepId: secondStep.id,
        target: { kind: "lesson", lessonId: lesson.id },
      }),
    ).resolves.toStrictEqual({ status: "invalidCursor" });

    await expect(
      getLessonQuestionThread({
        contextKind: "lesson",
        target: { kind: "lesson", lessonId: lesson.id },
      }),
    ).resolves.toMatchObject({ status: "ready", thread: { questions: [] } });
  });

  it("lets a learner ask on another step while an earlier step is unfinished", async () => {
    const { lesson, steps, user } = await createLesson(explanationSteps(2));
    mockSession(user.id);

    const results = await Promise.all(
      steps.map((step) =>
        createLessonQuestion({
          input: {
            context: { kind: "step", stepId: step.id, stepNumber: step.position + 1 },
            question: "Help with this part",
            requestId: randomUUID(),
          },
          target: { kind: "lesson", lessonId: lesson.id },
        }),
      ),
    );

    expect(results.map((result) => result.status)).toStrictEqual(["created", "created"]);
  });

  it("paginates the latest fifty questions without losing older turns", async () => {
    const { lesson, user } = await createLesson();
    mockSession(user.id);

    const created = await ask({
      context: { kind: "lesson" },
      lessonId: lesson.id,
      question: "Question 1",
    });

    const firstQuestion = await prisma.lessonQuestion.findUniqueOrThrow({
      where: { id: created.id },
    });

    const contextSnapshot = toDatabaseLessonQuestionContextSnapshot(
      parseLessonQuestionContextSnapshot(firstQuestion.contextSnapshot),
    );

    const firstCreatedAt = new Date("2026-01-01T00:00:00.000Z");

    await prisma.$transaction([
      prisma.lessonQuestion.update({
        data: { createdAt: firstCreatedAt, updatedAt: firstCreatedAt },
        where: { id: firstQuestion.id },
      }),
      prisma.lessonQuestion.createMany({
        data: Array.from({ length: 54 }, (_, index) => {
          const questionNumber = index + 2;
          const createdAt = new Date(firstCreatedAt.getTime() + questionNumber * 1000);

          return {
            contextKind: "lesson",
            contextSnapshot,
            createdAt,
            question: `Question ${questionNumber}`,
            requestFingerprint: `history-question-${questionNumber}`,
            requestId: randomUUID(),
            threadId: firstQuestion.threadId,
            updatedAt: createdAt,
          };
        }),
      }),
    ]);

    const result = await getLessonQuestionThread({
      target: { kind: "lesson", lessonId: lesson.id },
    });

    if (result.status !== "ready" || !result.thread) {
      throw new Error("Expected the learner's question thread");
    }

    expect(result.thread.questions.map((question) => question.question)).toStrictEqual(
      Array.from({ length: 50 }, (_, index) => `Question ${index + 6}`),
    );

    expect(result.thread).toMatchObject({ hasMore: true });
    expect(result.thread.nextCursor).not.toBeNull();

    const earlier = await getLessonQuestionThread({
      cursor: result.thread.nextCursor ?? undefined,
      target: { kind: "lesson", lessonId: lesson.id },
    });

    if (earlier.status !== "ready" || !earlier.thread) {
      throw new Error("Expected the earlier question page");
    }

    expect(earlier.thread).toMatchObject({ hasMore: false, nextCursor: null });

    expect(earlier.thread.questions.map((question) => question.question)).toStrictEqual(
      Array.from({ length: 5 }, (_, index) => `Question ${index + 1}`),
    );
  });
});
