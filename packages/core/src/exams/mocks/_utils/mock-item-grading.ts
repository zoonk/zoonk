import { type PartialCreditRule } from "@zoonk/ai/tasks/v2/research/partial-credit";
import { type JsonObject } from "@zoonk/utils/json";
import { type ChoiceItem, gradeChoiceAnswer } from "../../../learner/_utils/choice-items";
import { gradeMathAnswer, readRecordedMath } from "../../../learner/_utils/math-items";
import { matchesAcceptedAnswer, toTypedSnapshot } from "../../../learner/_utils/typed-items";
import { gradeOptionPicks } from "../../../library/items/option-picks";
import { type MistakeSnapshot, withMistakeStimulus } from "../../../mistakes/mistake-snapshot";
import { getPickCredit } from "../../scoring/partial-credit";
import { type MockAnswer, mockAnswerSchema, mockChoiceSchema } from "../mock-answer-contract";
import { type MockItem, serveMockMath, toMockQuestionView } from "./mock-items";

const BLANK = { dontKnow: true } as const;

/**
 * How a mock question went, graded by code: the share of its points it earned (`credit`, partial
 * only for several picks where the notice gives partial credit), whether it was right, what its
 * attempt keeps (a numeric answer with the numbers it was asked with), and what the notebook and
 * the review show.
 */
export type MockItemGrade = {
  /** Something was given: a pick, a number or a word, not a blank. */
  answered: boolean;
  credit: number;
  isCorrect: boolean;
  recorded: JsonObject;
  snapshot: MistakeSnapshot;
};

function gradeChoice({
  answer,
  item,
  partialCredit,
}: {
  answer: MockAnswer | null;
  item: ChoiceItem;
  partialCredit: PartialCreditRule;
}): MockItemGrade {
  const choice = mockChoiceSchema.safeParse(answer).data ?? null;
  const graded = gradeChoiceAnswer({ answer: choice ?? BLANK, item });
  const several = item.format === "multipleChoice" && choice && "selectedIndexes" in choice;

  const credit = several
    ? getPickCredit({
        picks: {
          ...gradeOptionPicks({ options: item.content.options, picked: choice.selectedIndexes }),
          options: item.content.options.length,
        },
        rule: partialCredit,
      })
    : Number(graded.isCorrect);

  return {
    answered: choice !== null,
    credit,
    isCorrect: graded.isCorrect,
    recorded: choice ?? BLANK,
    snapshot: graded.snapshot,
  };
}

/**
 * Grades a mock question by code: a pick against the right options (several picks by the notice's
 * partial credit), a number against the numbers this mock showed, a typed word against the
 * wordings code accepts. A typed answer code doesn't accept may still be right in other words,
 * which only grading with a model can tell (see `gradeMock`). An answer of another format's shape
 * is wrong, like any wrong pick.
 */
function gradeMockAnswer({
  answer,
  item,
  mockId,
  partialCredit,
}: {
  answer: MockAnswer | null;
  item: MockItem;
  mockId: string;
  partialCredit: PartialCreditRule;
}): MockItemGrade {
  if (item.format === "numeric") {
    const number = answer && "number" in answer ? answer.number : null;
    const version = serveMockMath({ item, mockId });
    const graded = gradeMathAnswer({ answer: number, item, version });

    return {
      answered: number !== null,
      credit: Number(graded.isCorrect),
      isCorrect: graded.isCorrect,
      recorded: number === null ? BLANK : graded.recorded,
      snapshot: graded.snapshot,
    };
  }

  if (item.format === "typed") {
    const text = answer && "text" in answer ? answer.text.trim() || null : null;
    const isCorrect = text !== null && matchesAcceptedAnswer({ item, text });

    return {
      answered: text !== null,
      credit: Number(isCorrect),
      isCorrect,
      recorded: text === null ? BLANK : { text },
      snapshot: toTypedSnapshot({ explanation: null, item, text }),
    };
  }

  return gradeChoice({ answer, item, partialCredit });
}

/** Every mock format saves the complete served question, including a number's drawn context. */
export function gradeMockItem(input: Parameters<typeof gradeMockAnswer>[0]): MockItemGrade {
  const graded = gradeMockAnswer(input);
  const question = toMockQuestionView({ item: input.item, mockId: input.mockId });

  return {
    ...graded,
    snapshot: withMistakeStimulus({
      snapshot: { ...graded.snapshot, question: question.question },
      stimulus: question,
    }),
  };
}

/**
 * An answer as its attempt stored it, in the shape the learner gave it: a numeric one also kept
 * the numbers it was asked with, which the answer's shape doesn't carry. Blank otherwise.
 */
export function readRecordedMockAnswer(value: unknown): MockAnswer | null {
  const parsed = mockAnswerSchema.safeParse(value);

  if (parsed.success) {
    return parsed.data;
  }

  const math = readRecordedMath(value);
  return math && math.number !== null ? { number: math.number } : null;
}
