import { randomUUID } from "node:crypto";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  setupPlayableLesson,
  stepOfKind,
} from "../lesson-player/_test-utils/playable-lesson-setup";
import { toMemoryFactView } from "../memory/_utils/memory-fact-view";
import { updateMemoryFromActivity } from "../memory/update-memory-from-activity";
import { mockQuestionGenerality } from "./_test-utils/question-generality";
import { parseLessonQuestionContextSnapshot } from "./_utils/context-snapshot-schema";
import {
  claimLessonQuestionAnswer,
  completeLessonQuestionAnswer,
  rememberLessonQuestionAnswer,
} from "./answer-lifecycle";
import { type LessonQuestionContextInput } from "./contract";
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

const MODEL = "openai/gpt-6-luna";

async function ask({
  context,
  lessonId,
  question = "Why a cloud?",
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

describe("questions about a Library lesson", () => {
  beforeEach(() => {
    vi.mocked(isRateLimited).mockResolvedValue(false);
    vi.mocked(updateMemoryFromActivity).mockResolvedValue([]);
    mockQuestionGenerality(false);
  });

  it("keeps a step's question in the learner's thread for the Library lesson", async () => {
    const { lesson, steps, user } = await setupPlayableLesson();
    const step = stepOfKind(steps, "explanation");

    const question = await ask({
      context: { kind: "step", stepId: step.id, stepNumber: 2 },
      lessonId: lesson.id,
    });

    expect(question).toMatchObject({
      answer: null,
      context: { kind: "step", stepId: step.id, stepNumber: 2 },
      status: "pending",
    });

    const [stored, thread] = await Promise.all([
      prisma.lessonQuestion.findUniqueOrThrow({
        include: { thread: true },
        where: { id: question.id },
      }),
      getLessonQuestionThread({ stepId: step.id, target: { kind: "lesson", lessonId: lesson.id } }),
    ]);

    expect(stored).toMatchObject({
      libraryStepId: step.id,
      thread: { libraryLessonId: lesson.id, userId: user.id },
    });

    expect(parseLessonQuestionContextSnapshot(stored.contextSnapshot)).toMatchObject({
      lesson: { kind: "library", title: lesson.title },
      scope: { kind: "step" },
      step: { kind: "explanation", stepNumber: 2 },
    });

    expect(thread).toMatchObject({
      status: "ready",
      thread: { lessonId: lesson.id, questions: [{ id: question.id }] },
    });
  });

  it("grades a check answer again on the server for the tutor", async () => {
    const { lesson, steps } = await setupPlayableLesson();
    const check = stepOfKind(steps, "check");

    const question = await ask({
      context: {
        answer: { kind: "check", optionId: "size" },
        kind: "answer",
        stepId: check.id,
        stepNumber: 3,
      },
      lessonId: lesson.id,
    });

    const stored = await prisma.lessonQuestion.findUniqueOrThrow({ where: { id: question.id } });

    expect(parseLessonQuestionContextSnapshot(stored.contextSnapshot)).toMatchObject({
      answer: {
        correctAnswer: "Where the electron is most likely to be found",
        feedback: "The cloud is far bigger than the electron. It maps chances, not size.",
        isCorrect: false,
        selectedAnswer: "The electron's size",
      },
    });
  });

  it("reads a typed answer's verdict from the learner's recorded answer", async () => {
    const { lesson, steps, user } = await setupPlayableLesson();
    const typed = stepOfKind(steps, "typedAnswer");
    await attemptFixture({ isCorrect: false, stepId: typed.id, userId: user.id });

    const question = await ask({
      context: {
        answer: { kind: "typedAnswer", text: "It spins around" },
        kind: "answer",
        stepId: typed.id,
        stepNumber: 4,
      },
      lessonId: lesson.id,
    });

    const stored = await prisma.lessonQuestion.findUniqueOrThrow({ where: { id: question.id } });

    expect(parseLessonQuestionContextSnapshot(stored.contextSnapshot)).toMatchObject({
      answer: { isCorrect: false, selectedAnswer: "It spins around" },
    });
  });

  it("refuses steps of another lesson, answers that don't fit and hidden lessons", async () => {
    const { lesson, steps } = await setupPlayableLesson();
    const other = await playableLessonFixture();
    const owner = await userFixture();

    const hidden = await playableLessonFixture({
      lesson: { ownerId: owner.id, visibility: "private" },
    });

    const create = (context: LessonQuestionContextInput, lessonId = lesson.id) =>
      createLessonQuestion({
        input: { context, question: "Why?", requestId: randomUUID() },
        target: { kind: "lesson", lessonId },
      });

    await expect(
      create({ kind: "step", stepId: stepOfKind(other.steps, "check").id, stepNumber: 1 }),
    ).resolves.toStrictEqual({ status: "invalidContext" });

    await expect(
      create({
        answer: { kind: "check", optionId: "missing" },
        kind: "answer",
        stepId: stepOfKind(steps, "check").id,
        stepNumber: 1,
      }),
    ).resolves.toStrictEqual({ status: "invalidContext" });

    await expect(create({ kind: "lesson" }, hidden.lesson.id)).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("claims the answer from the tutor allowance and reads the learner's memory", async () => {
    const { lesson, user } = await setupPlayableLesson();

    // An adult: memory is on for them until they turn it off, and off for minors until they turn it on.
    await Promise.all([
      learningProfileFixture({ birthMonth: 5, birthYear: 1990, userId: user.id }),
      memoryFactFixture({ statement: "Studies chemistry for a nursing exam", userId: user.id }),
    ]);

    const question = await ask({ context: { kind: "lesson" }, lessonId: lesson.id });

    const claimed = await claimLessonQuestionAnswer({
      questionId: question.id,
      requestedModel: MODEL,
    });

    expect(claimed).toMatchObject({
      claim: {
        analytics: { distinctId: user.id },
        learnerMemory: ["Studies chemistry for a nursing exam"],
        questionId: question.id,
      },
      status: "ready",
    });

    await expect(
      prisma.usageRecord.count({
        where: { kind: "tutorMessage", targetId: question.id, userId: user.id },
      }),
    ).resolves.toBe(1);
  });

  it("asks a guest to sign up and a free learner to wait once their allowance is used", async () => {
    const guest = await setupPlayableLesson({ guest: true });
    const guestQuestion = await ask({ context: { kind: "lesson" }, lessonId: guest.lesson.id });

    await expect(
      claimLessonQuestionAnswer({ questionId: guestQuestion.id, requestedModel: MODEL }),
    ).resolves.toMatchObject({
      decision: { limit: { resource: "tutorMessage", tier: "guest" }, status: "limitReached" },
      status: "usageRefused",
    });

    const learner = await setupPlayableLesson();
    await usageRecordsFixture({ count: 10, kind: "tutorMessage", userId: learner.user.id });
    const question = await ask({ context: { kind: "lesson" }, lessonId: learner.lesson.id });

    await expect(
      claimLessonQuestionAnswer({ questionId: question.id, requestedModel: MODEL }),
    ).resolves.toMatchObject({
      decision: { limit: { period: "day", resource: "tutorMessage" }, status: "limitReached" },
      status: "usageRefused",
    });

    // A refused claim releases the question, so it can be answered once the allowance allows.
    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: question.id } }),
    ).resolves.toMatchObject({ status: "failed" });
  });

  it("releases the claimed answer when the allowance check fails, so a retry can claim it", async () => {
    const { lesson } = await setupPlayableLesson();
    const question = await ask({ context: { kind: "lesson" }, lessonId: lesson.id });
    const outage = new Error("Firewall unavailable");

    // The allowance's rate-limit check is the only step that can fail without breaking the test
    // database too, so the firewall adapter stands in for an outage there.
    vi.mocked(isRateLimited).mockRejectedValueOnce(outage);

    await expect(
      claimLessonQuestionAnswer({ questionId: question.id, requestedModel: MODEL }),
    ).rejects.toBe(outage);

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: question.id } }),
    ).resolves.toMatchObject({ generationRevision: 1, status: "failed" });

    await expect(
      claimLessonQuestionAnswer({ questionId: question.id, requestedModel: MODEL }),
    ).resolves.toMatchObject({ claim: { revision: 2 }, status: "ready" });
  });

  it("saves the answer first, then updates memory from the exchange for the notice", async () => {
    const { lesson, user } = await setupPlayableLesson();

    const question = await ask({
      context: { kind: "lesson" },
      lessonId: lesson.id,
      question: "I need this for my nursing exam, where does it show up?",
    });

    const claimed = await claimLessonQuestionAnswer({
      questionId: question.id,
      requestedModel: MODEL,
    });

    const revision = claimed.status === "ready" ? claimed.claim.revision : 0;

    const fact = toMemoryFactView(
      await memoryFactFixture({ statement: "Preparing for a nursing exam", userId: user.id }),
    );

    const change = { action: "added" as const, fact, previous: null };
    vi.mocked(updateMemoryFromActivity).mockResolvedValue([change]);

    // Nothing is learned from an answer that isn't saved yet.
    await expect(rememberLessonQuestionAnswer({ questionId: question.id })).resolves.toStrictEqual(
      [],
    );

    // Saving is done on its own, so the learner can ask again while memory learns.
    await expect(
      completeLessonQuestionAnswer({
        ...ANSWER_RUN,
        answer: "It shows up in pharmacology.",
        finishReason: "stop",
        model: MODEL,
        provider: "openai",
        questionId: question.id,
        revision,
      }),
    ).resolves.toStrictEqual({ status: "updated" });

    expect(updateMemoryFromActivity).not.toHaveBeenCalled();

    // Another learner can't make memory learn from this exchange.
    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(rememberLessonQuestionAnswer({ questionId: question.id })).resolves.toStrictEqual(
      [],
    );

    mockSession(user.id);

    await expect(rememberLessonQuestionAnswer({ questionId: question.id })).resolves.toStrictEqual([
      change,
    ]);

    expect(updateMemoryFromActivity).toHaveBeenCalledExactlyOnceWith({
      source: {
        id: question.id,
        kind: "chat",
        language: lesson.language,
        messages: [
          { role: "learner", text: "I need this for my nursing exam, where does it show up?" },
          { role: "tutor", text: "It shows up in pharmacology." },
        ],
      },
      userId: user.id,
    });
  });

  it("answers another learner's question as not found", async () => {
    const { lesson } = await setupPlayableLesson();
    const question = await ask({ context: { kind: "lesson" }, lessonId: lesson.id });
    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(
      claimLessonQuestionAnswer({ questionId: question.id, requestedModel: MODEL }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
