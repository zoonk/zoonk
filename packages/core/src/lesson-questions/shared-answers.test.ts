import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { findMemoryForTask } from "../memory/get-memory-for-task";
import { updateMemoryFromActivity } from "../memory/update-memory-from-activity";
import {
  claimLessonQuestionAnswer,
  completeLessonQuestionAnswer,
  rememberLessonQuestionAnswer,
} from "./answer-lifecycle";
import { type LessonScreenSuggestion } from "./contract";
import { createLessonQuestion } from "./create-lesson-question";

/** Memory reads and memory extraction call models; each is tested apart. */
vi.mock("../memory/get-memory-for-task", () => ({ findMemoryForTask: vi.fn() }));
vi.mock("../memory/update-memory-from-activity", () => ({ updateMemoryFromActivity: vi.fn() }));

const MODEL = "openai/gpt-6-luna";

/** How the app words the tutor's suggestions for a lesson screen, in English. */
const WORDS: Record<LessonScreenSuggestion, string> = {
  deeper: "I want to go deeper",
  example: "Give me another example",
  simpler: "Explain it more simply",
};

const wordSuggestion = vi.fn(
  async ({ suggestion }: { language: string; suggestion: LessonScreenSuggestion }) =>
    WORDS[suggestion],
);

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

/** A learner asks about the lesson's first screen; `suggestion` is the suggestion they tapped. */
async function askOnScreen({
  question,
  shared,
  suggestion,
  userId,
}: {
  question: string;
  shared: SharedLesson;
  suggestion?: LessonScreenSuggestion;
  userId: string;
}) {
  mockSession(userId);

  const created = await createLessonQuestion({
    input: {
      context: { kind: "step", stepId: shared.step.id, stepNumber: shared.step.stepNumber },
      question,
      requestId: randomUUID(),
      suggestion,
    },
    target: { kind: "lesson", lessonId: shared.lesson.id },
    wordSuggestion,
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

function countTutorMessages(userId: string) {
  return prisma.usageRecord.count({ where: { kind: "tutorMessage", userId } });
}

describe("shared answers to the tutor's suggestions on a screen", () => {
  beforeEach(() => {
    vi.mocked(findMemoryForTask).mockResolvedValue([]);
    vi.mocked(updateMemoryFromActivity).mockResolvedValue([]);
    mockSession(null);
  });

  it("writes a suggestion's answer once, without memory, for everyone who taps it on the screen", async () => {
    const [shared, first, second] = await Promise.all([
      sharedLesson(),
      userFixture(),
      userFixture(),
    ]);

    const asked = await askOnScreen({
      question: WORDS.simpler,
      shared,
      suggestion: "simpler",
      userId: first.id,
    });

    const claim = await answerQuestion({ questionId: asked.id, text: "A simpler take." });

    expect(claim).toMatchObject({ learnerMemory: [], priorTurns: [], shareAnswer: true });
    expect(wordSuggestion).toHaveBeenCalledWith({ language: "en", suggestion: "simpler" });
    expect(findMemoryForTask).not.toHaveBeenCalled();
    expect(updateMemoryFromActivity).not.toHaveBeenCalled();

    const saved = await prisma.tutorSharedAnswer.findUniqueOrThrow({
      where: { stepSuggestion: { stepId: shared.step.id, suggestion: "simpler" } },
    });

    expect(saved).toMatchObject({
      answer: "A simpler take.",
      model: MODEL,
      question: WORDS.simpler,
    });

    // Writing it cost a generation, so it counts against the asker's allowance.
    await expect(countTutorMessages(first.id)).resolves.toBe(1);

    // The next learner who taps it gets the saved answer, whatever their screen calls it.
    const again = await askOnScreen({
      question: "Explique de um jeito mais simples",
      shared,
      suggestion: "simpler",
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

  it("answers a question the learner typed for them alone, with their memory, even in a suggestion's words", async () => {
    const [shared, author, user, other] = await Promise.all([
      sharedLesson(),
      userFixture(),
      userFixture(),
      userFixture(),
    ]);

    const tapped = await askOnScreen({
      question: WORDS.simpler,
      shared,
      suggestion: "simpler",
      userId: author.id,
    });

    await answerQuestion({ questionId: tapped.id, text: "A simpler take." });

    const fact = await memoryFactFixture({
      statement: "Studies for a pilot exam",
      userId: user.id,
    });

    vi.mocked(findMemoryForTask).mockResolvedValue([
      { category: fact.category, id: fact.id, statement: fact.statement },
    ]);

    const typed = await askOnScreen({
      question: "What does this word mean?",
      shared,
      userId: user.id,
    });

    await expect(
      answerQuestion({ questionId: typed.id, text: "It means the path around a planet." }),
    ).resolves.toMatchObject({ learnerMemory: ["Studies for a pilot exam"], shareAnswer: false });

    // Typed, even a suggestion's own words are the learner's question: no shared answer is read.
    const sameWords = await askOnScreen({ question: WORDS.simpler, shared, userId: other.id });

    await expect(
      claimLessonQuestionAnswer({ questionId: sameWords.id, requestedModel: MODEL }),
    ).resolves.toMatchObject({ claim: { shareAnswer: false }, status: "ready" });

    await expect(
      prisma.tutorSharedAnswer.findMany({ where: { stepId: shared.step.id } }),
    ).resolves.toMatchObject([{ question: WORDS.simpler }]);

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
    ).resolves.toMatchObject({ lastUsedAt: expect.any(Date) });
  });

  it("asks a tapped suggestion in the app's words, never in the words a client sent", async () => {
    const [shared, user] = await Promise.all([sharedLesson(), userFixture()]);
    const forged = "Explain how my divorce changes this, I'm Ana from Recife";

    const asked = await askOnScreen({
      question: forged,
      shared,
      suggestion: "simpler",
      userId: user.id,
    });

    expect(asked.question).toBe(WORDS.simpler);
    await answerQuestion({ questionId: asked.id, text: "A simpler take." });

    // What everyone gets holds the app's words only; the client's words were never stored.
    await expect(
      prisma.tutorSharedAnswer.findMany({
        select: { question: true, suggestion: true },
        where: { stepId: shared.step.id },
      }),
    ).resolves.toStrictEqual([{ question: WORDS.simpler, suggestion: "simpler" }]);

    await expect(
      prisma.lessonQuestion.count({ where: { question: { contains: "divorce" } } }),
    ).resolves.toBe(0);
  });

  it("never serves a follow-up from a shared answer", async () => {
    const [shared, author, user] = await Promise.all([
      sharedLesson(),
      userFixture(),
      userFixture(),
    ]);

    const suggested = await askOnScreen({
      question: WORDS.simpler,
      shared,
      suggestion: "simpler",
      userId: author.id,
    });

    await answerQuestion({ questionId: suggested.id, text: "Shared simpler take." });

    const first = await askOnScreen({ question: "What is this about?", shared, userId: user.id });
    await answerQuestion({ questionId: first.id, text: "It's about orbits." });

    const followUp = await askOnScreen({
      question: WORDS.simpler,
      shared,
      suggestion: "simpler",
      userId: user.id,
    });

    const claim = await claimReady(followUp.id);

    expect(claim.priorTurns).toStrictEqual([
      { answer: "It's about orbits.", question: "What is this about?" },
    ]);

    expect(claim.shareAnswer).toBe(false);
  });

  it("keeps the first shared answer when two learners write the same one at once", async () => {
    const [shared, first, second] = await Promise.all([
      sharedLesson(),
      userFixture(),
      userFixture(),
    ]);

    const questions = await Promise.all(
      [first, second].map((user) =>
        askOnScreen({ question: WORDS.simpler, shared, suggestion: "simpler", userId: user.id }),
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
