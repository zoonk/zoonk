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

export type MockItemGrade = {
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

export function readRecordedMockAnswer(value: unknown): MockAnswer | null {
  const parsed = mockAnswerSchema.safeParse(value);

  if (parsed.success) {
    return parsed.data;
  }

  const math = readRecordedMath(value);
  return math && math.number !== null ? { number: math.number } : null;
}
