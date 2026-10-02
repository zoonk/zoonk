import { explainWrongAnswer } from "@zoonk/ai/tasks/v2/grading/explain-wrong-answer";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { GUEST_OUT_OF_HELP, useGuestOutOfHelp } from "../../_test-utils/guest-out-of-help";
import { mockSession } from "../../_test-utils/mock-session";
import { generatedProvenance, generatedTypedItem } from "./_test-utils/generated-items";
import { explainAnswer } from "./explain-answer";
import { toStoredItem } from "./item-content";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(async () => false),
}));

/** The model call is the external boundary; persistence and reuse run for real. */
vi.mock("@zoonk/ai/tasks/v2/grading/explain-wrong-answer", () => ({ explainWrongAnswer: vi.fn() }));

function mockExplanation(explanation: string) {
  vi.mocked(explainWrongAnswer).mockResolvedValueOnce({
    data: { explanation },
    provenance: {
      ...generatedProvenance(),
      latencyMs: 1,
      provider: "test",
      requestedModel: "test",
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

async function createTypedItem() {
  const skill = await skillFixture();
  const { content, format } = toStoredItem(generatedTypedItem());

  return itemFixture({ content, format, language: "en", skillId: skill.id });
}

const typedAnswerStep = {
  acceptedAnswers: ["45", "R$ 45"],
  keyPoints: ["Takes 25% of 60", "Subtracts it from 60"],
  question: "A R$ 60 shirt is 25% off. How much do you pay?",
  sampleAnswer: "25% of 60 is 15, so you pay R$ 45.",
};

async function createTypedAnswerStep(lesson: Parameters<typeof libraryLessonFixture>[0] = {}) {
  const createdLesson = await libraryLessonFixture({ language: "pt", ...lesson });

  return libraryStepFixture({
    content: typedAnswerStep,
    kind: "typedAnswer",
    lessonId: createdLesson.id,
  });
}

describe(explainAnswer, () => {
  it("asks a guest who used today's help to sign up before writing a new explanation", async () => {
    const step = await createTypedAnswerStep();
    await useGuestOutOfHelp();

    await expect(
      explainAnswer({ answer: "R$ 15", target: { stepId: step.id } }),
    ).resolves.toStrictEqual(GUEST_OUT_OF_HELP);

    expect(explainWrongAnswer).not.toHaveBeenCalled();
  });

  it("asks for a pause before writing a new explanation over the AI rate limit", async () => {
    const [step, learner] = await Promise.all([createTypedAnswerStep(), userFixture()]);

    mockSession(learner.id);
    vi.mocked(isRateLimited).mockResolvedValueOnce(true);

    await expect(
      explainAnswer({ answer: "R$ 15", target: { stepId: step.id } }),
    ).resolves.toMatchObject({ status: "slowDown" });

    expect(explainWrongAnswer).not.toHaveBeenCalled();
  });

  it("requires a signed-in learner", async () => {
    mockSession(null);

    await expect(
      explainAnswer({ answer: "chloroplast", target: { itemId: crypto.randomUUID() } }),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("explains a wrong answer once and reuses it for the next learner with the same mistake", async () => {
    const [item, learner, nextLearner] = await Promise.all([
      createTypedItem(),
      userFixture(),
      userFixture(),
    ]);

    const target = { itemId: item.id };

    mockSession(learner.id);
    mockExplanation("Chloroplasts make sugar; mitochondria release its energy.");

    const first = await explainAnswer({ answer: "Chloroplast", target });

    const stored = await prisma.answerExplanation.findFirstOrThrow({ where: { itemId: item.id } });

    expect(first).toStrictEqual({
      explanation: "Chloroplasts make sugar; mitochondria release its energy.",
      explanationId: stored.id,
      reused: false,
      status: "explained",
    });

    expect(explainWrongAnswer).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        analytics: { contentScope: "shared", distinctId: learner.id },
        answer: "Chloroplast",
        correctAnswer: "The mitochondria.",
        keyPoints: ["Names the mitochondria"],
        language: "en",
      }),
    );

    mockSession(nextLearner.id);

    const second = await explainAnswer({ answer: " chloroplast. ", target });

    expect(second).toStrictEqual({ ...first, reused: true });
    expect(explainWrongAnswer).toHaveBeenCalledOnce();

    await expect(prisma.answerExplanation.count({ where: { itemId: item.id } })).resolves.toBe(1);
  });

  it("explains a lesson step's typed answer in the lesson's language", async () => {
    const [step, learner] = await Promise.all([createTypedAnswerStep(), userFixture()]);

    mockSession(learner.id);
    mockExplanation("Você calculou o desconto, não o preço final.");

    const result = await explainAnswer({ answer: "15", target: { stepId: step.id } });

    expect(result).toStrictEqual({
      explanation: "Você calculou o desconto, não o preço final.",
      explanationId: expect.any(String),
      reused: false,
      status: "explained",
    });

    expect(explainWrongAnswer).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        correctAnswer: typedAnswerStep.sampleAnswer,
        keyPoints: typedAnswerStep.keyPoints,
        language: "pt",
        question: typedAnswerStep.question,
      }),
    );

    await expect(
      prisma.answerExplanation.findFirst({ where: { stepId: step.id } }),
    ).resolves.toMatchObject({ itemId: null, normalizedAnswer: "15" });
  });

  it("keeps private lessons' steps to their owner", async () => {
    const [owner, stranger] = await Promise.all([userFixture(), userFixture()]);
    const step = await createTypedAnswerStep({ ownerId: owner.id, visibility: "private" });

    mockSession(stranger.id);

    await expect(
      explainAnswer({ answer: "15", target: { stepId: step.id } }),
    ).resolves.toStrictEqual({ status: "notFound" });

    mockSession(owner.id);
    mockExplanation("Você calculou só o desconto.");

    await expect(
      explainAnswer({ answer: "15", target: { stepId: step.id } }),
    ).resolves.toMatchObject({ status: "explained" });
  });

  it("has nothing to explain for an accepted answer", async () => {
    const [item, learner] = await Promise.all([createTypedItem(), userFixture()]);
    mockSession(learner.id);

    await expect(
      explainAnswer({ answer: "Mitochondria.", target: { itemId: item.id } }),
    ).resolves.toStrictEqual({ status: "correct" });

    expect(explainWrongAnswer).not.toHaveBeenCalled();
  });

  it("rejects blank and oversized answers before any model runs", async () => {
    const [item, learner] = await Promise.all([createTypedItem(), userFixture()]);
    const target = { itemId: item.id };
    mockSession(learner.id);

    const results = await Promise.all([
      explainAnswer({ answer: " ?! ", target }),
      explainAnswer({ answer: "a".repeat(5000), target }),
    ]);

    expect(results).toStrictEqual([{ status: "invalid" }, { status: "invalid" }]);
    expect(explainWrongAnswer).not.toHaveBeenCalled();
  });

  it("only explains typed and spoken items and typed-answer steps", async () => {
    const [skill, lesson, learner] = await Promise.all([
      skillFixture(),
      libraryLessonFixture(),
      userFixture(),
    ]);

    mockSession(learner.id);

    const [multipleChoice, explanationStep] = await Promise.all([
      itemFixture({
        content: {
          context: null,
          options: [
            { isCorrect: true, misconception: null, reason: "Right.", text: "A" },
            { isCorrect: false, misconception: "Mix-up", reason: "Wrong.", text: "B" },
          ],
          question: "Pick one.",
        },
        skillId: skill.id,
      }),
      libraryStepFixture({ lessonId: lesson.id }),
    ]);

    const results = await Promise.all([
      explainAnswer({ answer: "B", target: { itemId: multipleChoice.id } }),
      explainAnswer({ answer: "B", target: { itemId: crypto.randomUUID() } }),
      explainAnswer({ answer: "B", target: { stepId: explanationStep.id } }),
    ]);

    expect(results).toStrictEqual([
      { status: "notFound" },
      { status: "notFound" },
      { status: "notFound" },
    ]);
  });
});
