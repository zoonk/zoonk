import { randomUUID } from "node:crypto";
import { classifyQuestionGenerality } from "@zoonk/ai/tasks/v2/explain/question-generality";
import { prisma } from "@zoonk/db";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { findMemoryForTask } from "../memory/get-memory-for-task";
import { updateMemoryFromActivity } from "../memory/update-memory-from-activity";
import { mockQuestionGenerality } from "./_test-utils/question-generality";
import {
  claimLessonQuestionAnswer,
  completeLessonQuestionAnswer,
  rememberLessonQuestionAnswer,
} from "./answer-lifecycle";
import { createLessonQuestion } from "./create-lesson-question";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The generality check, memory reads and memory extraction call models; each is tested apart. */
vi.mock("@zoonk/ai/tasks/v2/explain/question-generality", () => ({
  classifyQuestionGenerality: vi.fn(),
}));

vi.mock("../memory/get-memory-for-task", () => ({ findMemoryForTask: vi.fn() }));
vi.mock("../memory/update-memory-from-activity", () => ({ updateMemoryFromActivity: vi.fn() }));

const MODEL = "openai/gpt-6-luna";
const SUGGESTION = "Explain this more simply";

function answerRun(answer: string) {
  return {
    answer,
    finishReason: "stop",
    generatedAt: "2026-09-27T12:00:00.000Z",
    model: MODEL,
    promptVersion: "lesson-question-test",
    provider: "openai",
    runId: `run-${randomUUID()}`,
  };
}

async function sharedLesson() {
  const { lesson, steps } = await playableLessonFixture({ steps: ["explanation", "check"] });
  const step = steps[0];

  if (!step) {
    throw new Error("Expected the lesson's first screen");
  }

  return { lesson, step: { id: step.id, stepNumber: step.position + 1 } };
}

type SharedLesson = Awaited<ReturnType<typeof sharedLesson>>;

/** A learner asks about the lesson's first screen; `suggested` marks a tutor suggestion. */
async function askOnScreen({
  question,
  shared,
  suggested,
  userId,
}: {
  question: string;
  shared: SharedLesson;
  suggested?: true;
  userId: string;
}) {
  mockSession(userId);

  const created = await createLessonQuestion({
    input: {
      context: { kind: "step", stepId: shared.step.id, stepNumber: shared.step.stepNumber },
      question,
      requestId: randomUUID(),
      suggested,
    },
    target: { kind: "lesson", lessonId: shared.lesson.id },
  });

  if (created.status !== "created") {
    throw new Error(`Expected a created question, received ${created.status}`);
  }

  return created.question;
}

async function claimReady(questionId: string) {
  const claimed = await claimLessonQuestionAnswer({ questionId, requestedModel: MODEL });

  if (claimed.status !== "ready") {
    throw new Error(`Expected a ready claim, received ${claimed.status}`);
  }

  return claimed.claim;
}

/** Answers like the answers route: saved, then remembered when the answer is personal. */
async function answerQuestion({ questionId, text }: { questionId: string; text: string }) {
  const claim = await claimReady(questionId);

  await completeLessonQuestionAnswer({
    ...answerRun(text),
    questionId,
    revision: claim.revision,
    shareAnswer: claim.shareAnswer,
  });

  if (!claim.shareAnswer) {
    await rememberLessonQuestionAnswer({ questionId });
  }

  return claim;
}

/**
 * Answers the generality check only once the asker's memory is being read: reading memory after
 * deciding would never get there.
 */
async function answerOnceMemoryIsRead({
  isGeneral,
  userId,
}: {
  isGeneral: boolean;
  userId: string;
}) {
  await vi.waitFor(() =>
    expect(findMemoryForTask).toHaveBeenCalledWith(expect.objectContaining({ userId })),
  );

  return { isGeneral, probability: isGeneral ? 0.9 : 0.1 } as never;
}

function countTutorMessages(userId: string) {
  return prisma.usageRecord.count({ where: { kind: "tutorMessage", userId } });
}

describe("shared answers to common questions on a screen", () => {
  beforeEach(() => {
    vi.mocked(findMemoryForTask).mockResolvedValue([]);
    vi.mocked(updateMemoryFromActivity).mockResolvedValue([]);
    mockQuestionGenerality(false);
    mockSession(null);
  });

  it("writes a suggested question's answer once, without memory, for everyone on the screen", async () => {
    const [shared, first, second] = await Promise.all([
      sharedLesson(),
      userFixture(),
      userFixture(),
    ]);

    const asked = await askOnScreen({
      question: SUGGESTION,
      shared,
      suggested: true,
      userId: first.id,
    });

    const claim = await answerQuestion({ questionId: asked.id, text: "A simpler take." });

    expect(claim).toMatchObject({ learnerMemory: [], priorTurns: [], shareAnswer: true });
    expect(classifyQuestionGenerality).not.toHaveBeenCalled();
    expect(findMemoryForTask).not.toHaveBeenCalled();
    expect(updateMemoryFromActivity).not.toHaveBeenCalled();

    const saved = await prisma.tutorSharedAnswer.findUniqueOrThrow({
      where: {
        stepQuestion: { normalizedQuestion: "explain-this-more-simply", stepId: shared.step.id },
      },
    });

    expect(saved).toMatchObject({ answer: "A simpler take.", model: MODEL, question: SUGGESTION });

    // Writing it cost a generation, so it counts against the asker's allowance.
    await expect(countTutorMessages(first.id)).resolves.toBe(1);

    // The same question in other words and casing gets the saved answer, with no generation.
    const again = await askOnScreen({
      question: "explain this more simply?",
      shared,
      userId: second.id,
    });

    await expect(
      claimLessonQuestionAnswer({ questionId: again.id, requestedModel: MODEL }),
    ).resolves.toStrictEqual({ answer: "A simpler take.", questionId: again.id, status: "shared" });

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: again.id } }),
    ).resolves.toMatchObject({
      answer: "A simpler take.",
      generatedAt: saved.generatedAt,
      model: saved.model,
      promptVersion: saved.promptVersion,
      runId: saved.runId,
      sharedAnswerId: saved.id,
      status: "completed",
    });

    await expect(countTutorMessages(second.id)).resolves.toBe(0);
    expect(findMemoryForTask).not.toHaveBeenCalled();
    expect(updateMemoryFromActivity).not.toHaveBeenCalled();
  });

  it("shares a free-text question only when the classifier says it's general", async () => {
    const [shared, user, other] = await Promise.all([sharedLesson(), userFixture(), userFixture()]);

    const personal = await askOnScreen({
      question: "Why did my cake sink yesterday?",
      shared,
      userId: user.id,
    });

    const personalClaim = await answerQuestion({
      questionId: personal.id,
      text: "Personal answer.",
    });

    expect(personalClaim.shareAnswer).toBe(false);
    expect(findMemoryForTask).toHaveBeenCalledOnce();
    expect(updateMemoryFromActivity).toHaveBeenCalledOnce();

    mockQuestionGenerality(true);

    const general = await askOnScreen({
      question: "What does this word mean?",
      shared,
      userId: other.id,
    });

    await expect(
      answerQuestion({ questionId: general.id, text: "General answer." }),
    ).resolves.toMatchObject({ learnerMemory: [], shareAnswer: true });

    await expect(
      prisma.tutorSharedAnswer.findMany({ where: { stepId: shared.step.id } }),
    ).resolves.toMatchObject([
      { answer: "General answer.", question: "What does this word mean?" },
    ]);
  });

  it("reads memory while it decides whether to share, and marks it used only for a personal answer", async () => {
    const [shared, asker, other] = await Promise.all([
      sharedLesson(),
      userFixture(),
      userFixture(),
    ]);

    const [askerFact, otherFact] = await Promise.all([
      memoryFactFixture({ statement: "Studies for a nursing exam", userId: asker.id }),
      memoryFactFixture({ statement: "Studies for a pilot exam", userId: other.id }),
    ]);

    vi.mocked(findMemoryForTask).mockImplementation(async ({ userId }) =>
      [askerFact, otherFact]
        .filter((fact) => fact.userId === userId)
        .map((fact) => ({ category: fact.category, id: fact.id, statement: fact.statement })),
    );

    vi.mocked(classifyQuestionGenerality).mockImplementationOnce(() =>
      answerOnceMemoryIsRead({ isGeneral: true, userId: asker.id }),
    );

    const general = await askOnScreen({ question: "What is an orbit?", shared, userId: asker.id });

    await expect(claimReady(general.id)).resolves.toMatchObject({
      learnerMemory: [],
      shareAnswer: true,
    });

    vi.mocked(classifyQuestionGenerality).mockImplementationOnce(() =>
      answerOnceMemoryIsRead({ isGeneral: false, userId: other.id }),
    );

    const personal = await askOnScreen({
      question: "Will orbits be on my exam?",
      shared,
      userId: other.id,
    });

    await expect(claimReady(personal.id)).resolves.toMatchObject({
      learnerMemory: ["Studies for a pilot exam"],
      shareAnswer: false,
    });

    // Only the memory a personal answer reads counts as used.
    await expect(
      prisma.memoryFact.findMany({
        orderBy: { statement: "asc" },
        select: { lastUsedAt: true, statement: true },
        where: { id: { in: [askerFact.id, otherFact.id] } },
      }),
    ).resolves.toStrictEqual([
      { lastUsedAt: null, statement: "Studies for a nursing exam" },
      { lastUsedAt: expect.any(Date), statement: "Studies for a pilot exam" },
    ]);
  });

  it("never serves a follow-up from a shared answer", async () => {
    const [shared, author, user] = await Promise.all([
      sharedLesson(),
      userFixture(),
      userFixture(),
    ]);

    const suggested = await askOnScreen({
      question: SUGGESTION,
      shared,
      suggested: true,
      userId: author.id,
    });

    await answerQuestion({ questionId: suggested.id, text: "Shared simpler take." });

    const first = await askOnScreen({ question: "What is this about?", shared, userId: user.id });
    await answerQuestion({ questionId: first.id, text: "It's about orbits." });
    vi.mocked(classifyQuestionGenerality).mockClear();

    const followUp = await askOnScreen({
      question: SUGGESTION,
      shared,
      suggested: true,
      userId: user.id,
    });

    const claim = await claimReady(followUp.id);

    expect(claim.priorTurns).toStrictEqual([
      { answer: "It's about orbits.", question: "What is this about?" },
    ]);

    expect(claim.shareAnswer).toBe(false);
    expect(classifyQuestionGenerality).not.toHaveBeenCalled();
  });

  it("keeps the first shared answer when two learners write the same one at once", async () => {
    const [shared, first, second] = await Promise.all([
      sharedLesson(),
      userFixture(),
      userFixture(),
    ]);

    const questions = await Promise.all(
      [first, second].map((user) =>
        askOnScreen({ question: SUGGESTION, shared, suggested: true, userId: user.id }),
      ),
    );

    const claims = await Promise.all(
      questions.map(async (question, index) => {
        mockSession([first, second][index]?.id ?? null);
        return claimReady(question.id);
      }),
    );

    await Promise.all(
      questions.map((question, index) => {
        mockSession([first, second][index]?.id ?? null);

        return completeLessonQuestionAnswer({
          ...answerRun(`Answer ${index + 1}`),
          questionId: question.id,
          revision: claims[index]?.revision ?? 0,
          shareAnswer: true,
        });
      }),
    );

    const saved = await prisma.tutorSharedAnswer.findMany({ where: { stepId: shared.step.id } });
    expect(saved).toHaveLength(1);

    const stored = await prisma.lessonQuestion.findMany({
      where: { id: { in: questions.map((question) => question.id) } },
    });

    // Each learner keeps the answer they saw; both point at the one saved for everyone.
    expect(stored.map((question) => question.sharedAnswerId)).toStrictEqual([
      saved[0]?.id,
      saved[0]?.id,
    ]);

    expect(
      stored
        .map((question) => question.answer ?? "")
        .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(["Answer 1", "Answer 2"]);
  });
});
