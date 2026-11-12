import { gradeTypedAnswer } from "@zoonk/ai/tasks/grading/grade-typed-answer";
import { prisma } from "@zoonk/db";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { gradeMathAnswer, parseMathItem } from "../learner/_utils/math-items";
import { recordLearnerAnswer } from "../learner/record-learner-answer";
import { typedGrade } from "../lesson-player/_test-utils/typed-grade";
import { discountMath, discountQuestion } from "../library/items/_test-utils/math-problems";
import { withRecordedNumbers } from "../library/items/item-math";
import {
  type SessionQuestion,
  gradeSessionAnswer,
  parseSessionItem,
} from "../sessions/_utils/session-items";
import { type QuestionAnswer } from "../sessions/contract";
import { answerMistakePractice } from "./answer-mistake-practice";
import { getMistakePractice } from "./get-mistake-practice";
import { readMistakeSnapshot } from "./mistake-snapshot";

const YESTERDAY = new Date(Date.now() - 86_400_000);

async function numericSetup() {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

  const row = await itemFixture({
    content: { context: null, math: discountMath, question: discountQuestion },
    format: "numeric",
    skillId: skill.id,
  });

  const item = parseMathItem(row);

  if (!item) {
    throw new Error("The original must be playable");
  }

  mockSession(user.id);
  return { item, skill, user };
}

async function recordNumeric({
  item,
  user,
  price,
  discount,
  correct = false,
}: Awaited<ReturnType<typeof numericSetup>> & {
  price: number;
  discount: number;
  correct?: boolean;
}) {
  const version = withRecordedNumbers({
    ...item.content,
    language: item.language,
    values: { discount, price },
  });

  if (!version) {
    throw new Error("The original numbers must be valid");
  }

  const grade = gradeMathAnswer({ answer: correct ? version.answer : 999, item, version });

  const recorded = await recordLearnerAnswer({
    answer: grade.recorded,
    graded: { durationMs: 2000, isCorrect: grade.isCorrect },
    itemId: item.id,
    language: item.language,
    mistake: { questionText: grade.snapshot.question, snapshot: grade.snapshot },
    purpose: "learning",
    skillId: item.skillId,
    timeZone: "UTC",
    userId: user.id,
  });

  if (recorded.mistake) {
    await prisma.mistake.update({
      data: { createdAt: YESTERDAY, missedAt: YESTERDAY },
      where: { id: recorded.mistake.id },
    });
  }

  return recorded;
}

describe("exact bank question practice", () => {
  it("keeps two numeric originals separate and replays their original numbers after source deletion", async () => {
    const setup = await numericSetup();
    const first = await recordNumeric({ ...setup, discount: 20, price: 100 });
    const second = await recordNumeric({ ...setup, discount: 10, price: 200 });
    expect(first.mistake?.id).not.toBe(second.mistake?.id);
    await prisma.item.delete({ where: { id: setup.item.id } });
    const practice = await getMistakePractice({ includeAllFormats: true, timeZone: "UTC" });
    expect(practice.status).toBe("ready");

    if (practice.status !== "ready" || !first.mistake || !second.mistake) {
      throw new Error("Both originals must be playable");
    }

    expect(practice.practice.map((entry) => entry.questions[0]?.question)).toStrictEqual([
      "A shirt costs 100 and is 20% off. How much do you pay?",
      "A shirt costs 200 and is 10% off. How much do you pay?",
    ]);

    const result = await answerMistakePractice({
      input: {
        answer: { number: 80 },
        attemptId: crypto.randomUUID(),
        durationMs: 2000,
        itemId: setup.item.id,
      },
      mistakeId: first.mistake.id,
    });

    expect(result).toMatchObject({
      feedback: {
        correctAnswer: { number: 80 },
        fixed: true,
        fixedMistakeIds: [first.mistake.id],
        workedSteps: [expect.any(String), expect.any(String)],
      },
      status: "ready",
    });

    await expect(
      prisma.mistake.findUnique({ where: { id: second.mistake.id } }),
    ).resolves.toMatchObject({ status: "open" });
  });

  it("restores legacy numeric originals from their attempt and rejects recall with different numbers", async () => {
    const setup = await numericSetup();
    const first = await recordNumeric({ ...setup, discount: 20, price: 100 });

    if (!first.mistake) {
      throw new Error("The original must be saved");
    }

    await prisma.mistake.update({
      data: { snapshot: readMistakeSnapshot(first.mistake.snapshot) },
      where: { id: first.mistake.id },
    });

    const different = await recordNumeric({ ...setup, correct: true, discount: 10, price: 200 });
    expect(different.fixedMistakeIds).toStrictEqual([]);
    const practice = await getMistakePractice({ includeAllFormats: true, timeZone: "UTC" });

    expect(practice).toMatchObject({
      practice: [
        {
          mistakeId: first.mistake.id,
          questions: [
            {
              format: "numeric",
              question: "A shirt costs 100 and is 20% off. How much do you pay?",
            },
          ],
        },
      ],
      status: "ready",
    });

    const result = await answerMistakePractice({
      input: {
        answer: { number: 80 },
        attemptId: crypto.randomUUID(),
        durationMs: 2000,
        itemId: setup.item.id,
      },
      mistakeId: first.mistake.id,
    });

    expect(result).toMatchObject({
      feedback: { correctAnswer: { number: 80 }, fixed: true },
      status: "ready",
    });
  });
});

const ORDERED_STEPS = ["Start", "Then", "Finish"];

function originalAnswer(question: SessionQuestion): QuestionAnswer {
  if (question.format === "typed") {
    return { text: "went" };
  }

  if (question.format === "order") {
    return { order: ORDERED_STEPS.map((step) => question.options.indexOf(step)) };
  }

  if (question.format === "matchPairs") {
    return { matches: ["one", "two"].map((right) => question.right.indexOf(right)) };
  }

  throw new Error("Expected a supported original");
}

describe("other original bank formats", () => {
  it.each([
    {
      content: {
        acceptedAnswers: ["went"],
        context: "Yesterday",
        keyPoints: ["Past tense of go"],
        question: "She ___ to school.",
        sampleAnswer: "went",
      },
      format: "typed" as const,
    },
    {
      content: {
        question: "Put these events in order.",
        reason: "Follow the timeline.",
        steps: ORDERED_STEPS,
      },
      format: "order" as const,
    },
    {
      content: {
        pairs: [
          { left: "1", right: "one" },
          { left: "2", right: "two" },
        ],
        question: "Match each number to its word.",
        reason: "Each number names its word.",
      },
      format: "matchPairs" as const,
    },
  ])(
    "replays and grades the original $format question without a substitute",
    async ({ content, format }) => {
      const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
      const row = await itemFixture({ content, format, skillId: skill.id });
      const item = parseSessionItem(row);

      if (!item) {
        throw new Error("The original must be playable");
      }

      const wrong = gradeSessionAnswer({ answer: { dontKnow: true }, blockId: item.id, item });

      const recorded = await recordLearnerAnswer({
        answer: wrong.recorded,
        graded: { durationMs: 2000, isCorrect: false },
        itemId: item.id,
        language: item.language,
        mistake: { questionText: wrong.snapshot.question, snapshot: wrong.snapshot },
        purpose: "learning",
        skillId: skill.id,
        timeZone: "UTC",
        userId: user.id,
      });

      if (!recorded.mistake) {
        throw new Error("The wrong answer must save a mistake");
      }

      await prisma.mistake.update({
        data: { createdAt: YESTERDAY, missedAt: YESTERDAY },
        where: { id: recorded.mistake.id },
      });

      mockSession(user.id);
      const practice = await getMistakePractice({ includeAllFormats: true, timeZone: "UTC" });
      const question = practice.status === "ready" ? practice.practice[0]?.questions[0] : null;

      if (!question) {
        throw new Error("The original must be offered");
      }

      expect(question).toMatchObject({ format, itemId: item.id, question: content.question });

      await expect(
        answerMistakePractice({
          input: {
            answer: originalAnswer(question),
            attemptId: crypto.randomUUID(),
            durationMs: 2000,
            itemId: item.id,
          },
          mistakeId: recorded.mistake.id,
        }),
      ).resolves.toMatchObject({
        feedback: { fixed: true, fixedMistakeIds: [recorded.mistake.id] },
        status: "ready",
      });
    },
  );

  it("admits one model grading request for an original typed bank question", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

    const row = await itemFixture({
      content: {
        acceptedAnswers: [],
        context: null,
        keyPoints: ["Past tense"],
        question: "Explain the past tense.",
        sampleAnswer: "The action happened earlier.",
      },
      format: "typed",
      skillId: skill.id,
    });

    const item = parseSessionItem(row);

    if (!item) {
      throw new Error("The original must be playable");
    }

    const wrong = gradeSessionAnswer({ answer: { dontKnow: true }, blockId: item.id, item });

    const recorded = await recordLearnerAnswer({
      answer: wrong.recorded,
      graded: { durationMs: 2000, isCorrect: false },
      itemId: item.id,
      language: item.language,
      mistake: { questionText: wrong.snapshot.question, snapshot: wrong.snapshot },
      purpose: "learning",
      skillId: skill.id,
      timeZone: "UTC",
      userId: user.id,
    });

    if (!recorded.mistake) {
      throw new Error("The wrong answer must save a mistake");
    }

    await prisma.mistake.update({
      data: { createdAt: YESTERDAY, missedAt: YESTERDAY },
      where: { id: recorded.mistake.id },
    });

    mockSession(user.id);
    const entered = Promise.withResolvers<null>();
    const released = Promise.withResolvers<null>();

    vi.mocked(gradeTypedAnswer).mockImplementationOnce(async () => {
      entered.resolve(null);
      await released.promise;
      return typedGrade({ feedback: "The saved original feedback", isCorrect: true, score: 1 });
    });

    const input = {
      answer: { text: "It happened before now." },
      attemptId: crypto.randomUUID(),
      durationMs: 2000,
      itemId: item.id,
    };

    const first = answerMistakePractice({ input, mistakeId: recorded.mistake.id });
    await entered.promise;

    await expect(
      answerMistakePractice({ input, mistakeId: recorded.mistake.id }),
    ).resolves.toStrictEqual({ status: "retryable" });

    released.resolve(null);
    const result = await first;

    await expect(
      answerMistakePractice({
        input: { ...input, answer: { text: "A different retry" } },
        mistakeId: recorded.mistake.id,
      }),
    ).resolves.toStrictEqual(result);

    expect(gradeTypedAnswer).toHaveBeenCalledOnce();

    await expect(
      prisma.modelGrade.count({ where: { questionId: item.id, userId: user.id } }),
    ).resolves.toBe(1);
  });
});
