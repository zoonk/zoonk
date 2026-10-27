import { gradeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { thirdsMath, thirdsQuestion } from "../../library/items/_test-utils/math-problems";
import { getMock } from "./get-mock";
import { type MockAnswer } from "./mock-answer-contract";
import { type MockView } from "./mock-contract";
import { saveMockAnswer } from "./save-mock-answer";
import { startAnytimeMock } from "./start-anytime-mock";
import { submitMockSection } from "./submit-mock-section";

const CITATION = { passage: "From the notice.", sourceId: "source" };
const SUBJECT = "Paper 1";

/** "One or more options correct", two of its four right, as JEE Advanced asks. */
const SELECT_ALL = {
  context: "A patient takes 1 g of paracetamol every 6 hours.",
  fixedOrder: true,
  options: [
    { isCorrect: true, misconception: null, reason: "4 doses of 1 g.", text: "4 g a day" },
    { isCorrect: true, misconception: null, reason: "Below the 4 g limit.", text: "Within limit" },
    { isCorrect: false, misconception: "Counts 12 hours", reason: "Every 6 hours.", text: "2 g" },
    { isCorrect: false, misconception: "Ignores the limit", reason: "4 g is it.", text: "Over" },
  ],
  question: "Which statements are true?",
  select: "all",
};

/** One right option of four, left blank in the mock: no penalty. */
function onePick(question: string) {
  return {
    ...SELECT_ALL,
    options: SELECT_ALL.options.map((option, index) => ({ ...option, isCorrect: index === 0 })),
    question,
    select: 1,
  };
}

/** A number typed into the answer box: a fraction or a decimal, like the SAT's grid-ins. */
const FRACTION = {
  context: null,
  entry: { kind: "fraction", places: null },
  math: thirdsMath,
  otherSolutions: [],
  question: thirdsQuestion,
};

const TYPED_WORD = {
  acceptedAnswers: ["went"],
  context: null,
  keyPoints: ["Uses the past tense of go"],
  question: "Complete the sentence: Yesterday she ____ (go) to school.",
  sampleAnswer: "went",
};

const ITEMS = [
  { content: SELECT_ALL, format: "multipleChoice" },
  { content: FRACTION, format: "numeric" },
  { content: TYPED_WORD, format: "typed" },
  { content: { ...TYPED_WORD, question: `${TYPED_WORD.question} ` }, format: "typed" },
  { content: onePick("Which dose is safe?"), format: "multipleChoice" },
  { content: onePick("Which dose is the limit?"), format: "multipleChoice" },
] as const;

/**
 * An exam like JEE Advanced: questions with one or more right options scored +1 per right option
 * picked (`perOption`), numbers typed into a box, words typed in, and half a question lost for a
 * wrong answer; one section of six questions.
 */
async function formatsSetup() {
  const [user, blueprint, skill] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      structure: {
        formats: [
          {
            citation: CITATION,
            description: "One or more options correct",
            kind: "multipleChoice",
            options: 4,
            partialCredit: "perOption",
            select: "all",
          },
          {
            citation: CITATION,
            description: "A fraction or a decimal",
            entry: { kind: "fraction", places: null },
            kind: "numeric",
            options: null,
          },
          { citation: CITATION, description: "A word", kind: "shortAnswer", options: null },
        ],
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "", method: "wrongCancelsRight", wrongPenalty: 0.5 },
          sections: [{ day: null, kind: "objective", minutes: 12, name: SUBJECT, questions: 6 }],
          timeLimitMinutes: 12,
          totalQuestions: 6,
        },
        rules: [],
        subjects: [{ citation: CITATION, name: SUBJECT, questions: 6, topics: [], weight: null }],
      },
    }),
    skillFixture({ name: `${SUBJECT} ${crypto.randomUUID()}` }),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    userId: user.id,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: [
        { area: SUBJECT, lessons: 1, name: skill.name, phase: 0, skillId: skill.id, weight: null },
      ],
    },
  });

  const items = await Promise.all(
    ITEMS.map((item) =>
      itemFixture({
        content: item.content,
        examBlueprintId: blueprint.id,
        format: item.format,
        skillId: skill.id,
      }),
    ),
  );

  await Promise.all([
    planItemFixture({ kind: "lesson", planId: plan.id, position: 0, skillId: skill.id }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  mockSession(user.id);

  // The bank holds one question of several picks where the notice's mix wants two: the mock
  // starts with what there is instead of having one written.
  const started = await startAnytimeMock({
    goalId: goal.id,
    input: { acceptFewer: true, shape: { area: null, day: null, kind: "full" } },
  });

  if (started.status !== "started") {
    throw new Error(`Expected a started mock, got ${started.status}`);
  }

  const [pick, number, word, miss] = items.map((item) => item.id);
  return { id: started.id, itemIds: { miss, number, pick, word } };
}

async function readMock(id: string): Promise<MockView> {
  const result = await getMock(id);

  if (result.status !== "ready") {
    throw new Error("Expected the mock");
  }

  return result.mock;
}

function answer({ id, itemId, value }: { id: string; itemId?: string; value: MockAnswer }) {
  return saveMockAnswer({
    blockId: id,
    input: { answer: value, durationMs: 5000, flagged: false, itemId: itemId ?? "" },
  });
}

describe("a mock in the exam's own answer formats", () => {
  it("asks several picks, a typed number and a typed word, and scores them as the notice does", async () => {
    // A model grades a typed answer code doesn't accept. Here it says "goed" is wrong, so the mock
    // counts what the model says.
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

    const { id, itemIds } = await formatsSetup();
    const started = await readMock(id);
    const questions = new Map(started.current?.questions.map((item) => [item.itemId, item]));

    expect(questions.get(itemIds.pick ?? "")).toMatchObject({
      format: "multipleChoice",
      select: "all",
    });

    expect(questions.get(itemIds.number ?? "")).toMatchObject({
      entry: { kind: "fraction", places: null },
      format: "numeric",
      options: null,
    });

    expect(questions.get(itemIds.word ?? "")).toMatchObject({ format: "typed", options: null });

    // It asks the exam's typed number and word as the exam does, so it says it leaves out neither.
    expect(started.leftOut).toStrictEqual([]);

    // Words only go to a question typed in words.
    await expect(
      answer({ id, itemId: itemIds.pick, value: { text: "4 g a day" } }),
    ).resolves.toStrictEqual({ status: "invalidItem" });

    // One of the two right options, no wrong one: +1 of +4. Two thirds typed as a number.
    await answer({ id, itemId: itemIds.pick, value: { selectedIndexes: [0] } });
    await answer({ id, itemId: itemIds.number, value: { number: 2 / 3 } });
    await answer({ id, itemId: itemIds.word, value: { text: " Went " } });
    await answer({ id, itemId: itemIds.miss, value: { text: "goed" } });

    await submitMockSection({ blockId: id, input: { timeZone: "UTC" }, section: 0 });

    const finished = await readMock(id);

    // A quarter of the pick, the number and the word; the miss loses half a question, blanks none.
    expect(finished.result).toMatchObject({
      correct: 2.25,
      net: { blank: 2, net: 1.75, partial: 1, penalty: 0.5, right: 2, wrong: 1 },
    });

    // Only the word code doesn't accept went to the model.
    expect(gradeTypedAnswer).toHaveBeenCalledOnce();
    expect(vi.mocked(gradeTypedAnswer).mock.calls[0]?.[0]).toMatchObject({ answer: "goed" });

    const review = new Map(finished.review.map((entry) => [entry.itemId, entry]));

    expect(review.size).toBe(4);
    expect(review.get(itemIds.miss ?? "")?.outcome).toBe("wrong");

    expect(review.get(itemIds.pick ?? "")).toMatchObject({
      correctAnswer: "4 g a day; Within limit",
      learnerAnswer: "4 g a day",
      outcome: "partial",
    });

    const attempts = await prisma.attempt.findMany({ where: { mockExamId: id } });
    const numberAttempt = attempts.find((attempt) => attempt.itemId === itemIds.number);

    // The number keeps the values it was asked with, so its review reads the same question.
    expect(numberAttempt).toMatchObject({ answer: { number: 2 / 3 }, isCorrect: true });
  });
});
