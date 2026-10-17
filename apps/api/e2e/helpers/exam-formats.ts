import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { citation } from "./exams";

/** A quick question per format beside the three in the exam's other answer formats. */
const FORMATS_QUICK_QUESTIONS = 3;

/** The questions of `createFormatsExamGoal`'s mock: the quick ones and the three formats. */
export const FORMATS_QUESTIONS = FORMATS_QUICK_QUESTIONS + 3;

/** Two of four options right, as JEE Advanced's "one or more options correct". */
const SEVERAL_PICKS = {
  context: null,
  fixedOrder: true,
  options: [
    { isCorrect: true, misconception: null, reason: "2 + 2 is 4.", text: "2 + 2 = 4" },
    { isCorrect: true, misconception: null, reason: "3 × 3 is 9.", text: "3 × 3 = 9" },
    { isCorrect: false, misconception: "Adds one", reason: "5 − 1 is 4.", text: "5 − 1 = 5" },
    { isCorrect: false, misconception: "Halves", reason: "8 ÷ 2 is 4.", text: "8 ÷ 2 = 3" },
  ],
  question: "Which of these are true?",
  select: "all",
};

/** Two thirds of a pizza left, with fixed numbers, typed as a fraction or a decimal. */
const FRACTION = {
  context: null,
  entry: { kind: "fraction", places: null },
  math: {
    answer: 2 / 3,
    commonMistakes: [
      { expression: "eaten / slices", misconception: "Eaten share", reason: "That's eaten." },
    ],
    solution: "(slices - eaten) / slices",
    steps: [],
    tolerance: { kind: "absolute", value: 0.005 },
    unit: null,
    variables: [
      { max: 3, min: 3, name: "slices", step: 1, unit: null, value: 3 },
      { max: 1, min: 1, name: "eaten", step: 1, unit: null, value: 1 },
    ],
  },
  otherSolutions: [],
  question: "A pizza has {slices} slices and you eat {eaten}. What share is left?",
};

const WORD = {
  acceptedAnswers: ["prime"],
  context: null,
  keyPoints: ["Names a prime number"],
  question: "A number whose only divisors are 1 and itself is called ____.",
  sampleAnswer: "prime",
};

/**
 * An exam goal like JEE Advanced: one paper whose questions may have one right option or several
 * (+1 per right option picked, all of them the full mark), take a fraction typed into a box, or a
 * word typed in, in the mix the notice counts, which the bank holds; one mock section asks every
 * question in its bank.
 */
export async function createFormatsExamGoal(userId: string) {
  const [blueprint, skill] = await Promise.all([
    examBlueprintFixture({
      name: "Formats Test",
      structure: {
        formats: [
          {
            citation,
            description: "One option correct",
            kind: "multipleChoice",
            options: null,
            share: FORMATS_QUICK_QUESTIONS / FORMATS_QUESTIONS,
          },
          {
            citation,
            description: "One or more options correct",
            kind: "multipleChoice",
            options: null,
            partialCredit: "perOption",
            select: "all",
            share: 1 / FORMATS_QUESTIONS,
          },
          {
            citation,
            description: "A fraction or a decimal",
            entry: { kind: "fraction", places: null },
            kind: "numeric",
            options: null,
            share: 1 / FORMATS_QUESTIONS,
          },
          {
            citation,
            description: "A word",
            kind: "shortAnswer",
            options: null,
            share: 1 / FORMATS_QUESTIONS,
          },
        ],
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "", method: "raw" },
          sections: [{ day: null, minutes: 12, name: "Paper 1", questions: FORMATS_QUESTIONS }],
          timeLimitMinutes: 12,
          totalQuestions: FORMATS_QUESTIONS,
        },
        rules: [],
        subjects: [
          { citation, name: "Paper 1", questions: FORMATS_QUESTIONS, topics: [], weight: null },
        ],
      },
    }),
    skillFixture({ name: `Paper 1 ${randomUUID()}` }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: userId, status: "active" },
    }),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    userId,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: [
        {
          area: "Paper 1",
          lessons: 1,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        },
      ],
    },
  });

  const item = (content: object, format: "multipleChoice" | "numeric" | "typed") =>
    itemFixture({ content, examBlueprintId: blueprint.id, format, skillId: skill.id });

  const [picks, number, word] = await Promise.all([
    item(SEVERAL_PICKS, "multipleChoice"),
    item(FRACTION, "numeric"),
    item(WORD, "typed"),
    planItemFixture({ kind: "lesson", planId: plan.id, position: 0, skillId: skill.id }),
    ...Array.from({ length: FORMATS_QUICK_QUESTIONS }, () =>
      item(choiceItemContent(), "multipleChoice"),
    ),
  ]);

  return { goal, itemIds: { number: number.id, picks: picks.id, word: word.id } };
}
