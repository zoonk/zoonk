import { gradeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { prisma } from "@zoonk/db";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { thirdsMath, thirdsQuestion } from "../library/items/_test-utils/math-problems";
import { getTodayStudySession } from "./_test-utils/open-today";
import {
  SESSION_NOW,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { answerStudyQuestion } from "./answer-study-question";
import { readBlockPayload } from "./block-payload";
import { getStudyBlock } from "./get-study-block";
import { startStudyBlock } from "./start-study-block";

const SELECT_ALL = {
  context: "A patient takes 1 g of paracetamol every 6 hours.",
  fixedOrder: false,
  options: [
    { isCorrect: true, misconception: null, reason: "4 doses of 1 g.", text: "4 g a day" },
    {
      isCorrect: true,
      misconception: null,
      reason: "Below the 4 g limit.",
      text: "Within the limit",
    },
    {
      isCorrect: false,
      misconception: "Counts 12 hours",
      reason: "It's every 6 hours.",
      text: "2 g a day",
    },
    {
      isCorrect: false,
      misconception: "Ignores the limit",
      reason: "4 g is the limit.",
      text: "Over the limit",
    },
  ],
  question: "Select all that apply.",
  select: "all",
};

const TYPED_WORD = {
  acceptedAnswers: ["went"],
  context: null,
  keyPoints: ["Uses the past tense of go"],
  question: "Complete the sentence: Yesterday she ____ (go) to school.",
  sampleAnswer: "went",
};

const TYPED_EXPLANATION = {
  ...TYPED_WORD,
  acceptedAnswers: [],
  question: "Explain why the past tense fits this sentence.",
  sampleAnswer: "Yesterday places the action in the past.",
};

const STEPS = ["Prophase", "Metaphase", "Anaphase", "Telophase"];

const ORDER = {
  question: "Put the phases of mitosis in order.",
  reason: "Chromosomes condense, line up, split and then the nuclei form.",
  steps: STEPS,
};

const FRACTION = {
  context: null,
  entry: { kind: "fraction", places: null },
  math: thirdsMath,
  otherSolutions: [],
  question: thirdsQuestion,
};

/** Today's practice block holding the given questions, started, for a learner of their skill. */
async function practiceBlock(
  items: { content: object; format: "multipleChoice" | "numeric" | "order" | "typed" }[],
) {
  const user = await userFixture();

  const { goal, skills } = await sessionGoalFixture({
    itemsPerSkill: 0,
    lessons: 1,
    userId: user.id,
  });

  const skillId = skills[0]?.id ?? "";

  const created = await Promise.all(
    items.map((item) => itemFixture({ content: item.content, format: item.format, skillId })),
  );

  const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

  const block = await studySessionBlockFixture({
    kind: "practice",
    payload: { itemIds: created.map((item) => item.id), skillIds: [skillId] },
    sessionId: session.id,
  });

  mockSession(user.id);
  const ref = { blockId: block.id, sessionId: session.id };
  await startStudyBlock({ ...ref, input: {} });
  const detail = await getStudyBlock(ref);

  if (detail.status !== "ready") {
    throw new Error("Expected the block's questions");
  }

  return { itemIds: created.map((item) => item.id), questions: detail.detail.questions, ref, user };
}

function answer({
  answer: given,
  itemId,
  ref,
}: {
  answer: Parameters<typeof answerStudyQuestion>[0]["input"]["answer"];
  itemId: string;
  ref: { blockId: string; sessionId: string };
}) {
  return answerStudyQuestion({ ...ref, input: { answer: given, durationMs: 4000, itemId } });
}

describe("exam answer formats in practice", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
    // A test that needs the grader's model gives its verdict: tests check when it's asked and that
    // its verdict counts.
    vi.mocked(gradeTypedAnswer).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks a typed number the way its exam's answer box takes it", async () => {
    const { itemIds, questions, ref } = await practiceBlock([
      { content: FRACTION, format: "numeric" },
      { content: FRACTION, format: "numeric" },
    ]);

    expect(questions[0]).toMatchObject({
      entry: { kind: "fraction", places: null },
      format: "numeric",
      question: "A pizza has 3 slices and you eat 1. What share is left?",
    });

    const [fraction, rounded] = await Promise.all([
      answer({ answer: { number: 2 / 3 }, itemId: itemIds[0] ?? "", ref }),
      answer({ answer: { number: 0.67 }, itemId: itemIds[1] ?? "", ref }),
    ]);

    expect(fraction).toMatchObject({ feedback: { isCorrect: true }, status: "ready" });
    expect(rounded).toMatchObject({ feedback: { isCorrect: false }, status: "ready" });
  });

  it("asks for every right option and grades the picks as a whole", async () => {
    const { itemIds, questions, ref, user } = await practiceBlock([
      { content: SELECT_ALL, format: "multipleChoice" },
      { content: SELECT_ALL, format: "multipleChoice" },
    ]);

    const [question] = questions;
    const right = SELECT_ALL.options.flatMap((option, index) => (option.isCorrect ? [index] : []));
    const shown = question?.options ?? [];
    const rightShown = right.map((index) => shown.indexOf(SELECT_ALL.options[index]?.text ?? ""));

    expect(question).toMatchObject({ format: "multipleChoice", select: "all" });

    const allRight = await answer({
      answer: { selectedIndexes: rightShown },
      itemId: itemIds[0] ?? "",
      ref,
    });

    const oneMissed = await answer({
      answer: { selectedIndexes: rightShown.slice(0, 1) },
      itemId: itemIds[1] ?? "",
      ref,
    });

    expect(allRight).toMatchObject({
      feedback: {
        correctAnswer: { selectedIndexes: rightShown.toSorted((a, b) => a - b) },
        isCorrect: true,
      },
    });

    expect(oneMissed).toMatchObject({ feedback: { isCorrect: false, savedToNotebook: true } });

    // A miss explains what went wrong: the right option left out, not the one already right.
    expect(["4 doses of 1 g.", "Below the 4 g limit."]).toContain(
      oneMissed.status === "ready" ? oneMissed.feedback.explanation : null,
    );

    const attempts = await prisma.attempt.findMany({
      where: { itemId: { in: itemIds }, userId: user.id },
    });

    expect(attempts.map((attempt) => attempt.answer)).toStrictEqual(
      expect.arrayContaining([{ selectedIndexes: rightShown.slice(0, 1) }]),
    );
  });

  it("checks a typed word against its accepted answers and asks the model only about a miss", async () => {
    vi.mocked(gradeTypedAnswer).mockResolvedValue({
      data: {
        corrections: [],
        feedback: '"Goed" isn\'t a word: the past of go is went.',
        isCorrect: false,
        keyPoints: [{ met: false, text: "Uses the past tense of go" }],
        method: "model",
        score: 0,
        spelling: null,
      },
      provenance: null,
      systemPrompt: "",
      usage: null,
      userPrompt: "",
    });

    const { itemIds, questions, ref } = await practiceBlock([
      { content: TYPED_WORD, format: "typed" },
      { content: TYPED_WORD, format: "typed" },
    ]);

    expect(questions[0]).toMatchObject({ format: "typed", question: TYPED_WORD.question });

    const matched = await answer({ answer: { text: " Went." }, itemId: itemIds[0] ?? "", ref });

    expect(matched).toMatchObject({ feedback: { isCorrect: true }, status: "ready" });
    expect(gradeTypedAnswer).not.toHaveBeenCalled();

    const missed = await answer({ answer: { text: "goed" }, itemId: itemIds[1] ?? "", ref });

    expect(missed).toMatchObject({
      feedback: {
        correctAnswer: { text: "went" },
        explanation: '"Goed" isn\'t a word: the past of go is went.',
        isCorrect: false,
      },
    });

    expect(gradeTypedAnswer).toHaveBeenCalledOnce();
  });

  it("shows an ordering question's steps shuffled and grades the order given", async () => {
    const { itemIds, questions, ref } = await practiceBlock([
      { content: ORDER, format: "order" },
      { content: ORDER, format: "order" },
    ]);

    const [first, second] = itemIds.map((itemId) => {
      const shown = questions.find((question) => question.itemId === itemId)?.options ?? [];
      return { inOrder: STEPS.map((step) => shown.indexOf(step)), itemId, shown };
    });

    expect(questions[0]).toMatchObject({ format: "order", question: ORDER.question });
    expect(first?.shown.toSorted()).toStrictEqual(STEPS.toSorted());
    expect(first?.shown).not.toStrictEqual(STEPS);

    const swapped = [
      second?.inOrder[1] ?? 0,
      second?.inOrder[0] ?? 0,
      ...(second?.inOrder.slice(2) ?? []),
    ];

    const [right, wrong] = await Promise.all([
      answer({ answer: { order: first?.inOrder ?? [] }, itemId: first?.itemId ?? "", ref }),
      answer({ answer: { order: swapped }, itemId: second?.itemId ?? "", ref }),
    ]);

    expect(right).toMatchObject({ feedback: { isCorrect: true } });

    expect(wrong).toMatchObject({
      feedback: { correctAnswer: { order: second?.inOrder }, isCorrect: false },
    });
  });

  it("practices short typed answers from the bank, never typed explanations", async () => {
    const user = await userFixture();

    const { goal, planItems, skills } = await sessionGoalFixture({
      itemsPerSkill: 0,
      lessons: 1,
      userId: user.id,
    });

    const skillId = skills[0]?.id ?? "";

    // Starting from nothing, so the first week's placement questions stay out of the day. A
    // practice block needs two questions at least.
    const [word, otherWord, explanation] = await Promise.all([
      itemFixture({ content: TYPED_WORD, format: "typed", skillId }),
      itemFixture({ content: TYPED_WORD, format: "typed", skillId }),
      itemFixture({ content: TYPED_EXPLANATION, format: "typed", skillId }),
      prisma.planItem.update({ data: { status: "done" }, where: { id: planItems[0]?.id } }),
      prisma.goal.update({
        data: { details: { level: "none", purpose: "deep" } },
        where: { id: goal.id },
      }),
      dueSkillFixture({ due: daysAgo(-10), skillId, userId: user.id }),
    ]);

    mockSession(user.id);
    const today = await getTodayStudySession({ goalId: goal.id });
    const sessionId = today.status === "ready" ? today.session.id : "";

    const blocks = await prisma.studySessionBlock.findMany({
      where: { kind: "practice", sessionId },
    });

    const itemIds = blocks.flatMap((block) => readBlockPayload(block).itemIds);
    expect(itemIds).toStrictEqual(expect.arrayContaining([word?.id, otherWord?.id]));
    expect(itemIds).not.toContain(explanation?.id);
  });
});
