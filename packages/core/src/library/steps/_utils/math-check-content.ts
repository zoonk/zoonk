import { type GeneratedMathProblem } from "@zoonk/ai/tasks/v2/items/schemas";
import { formatMathAnswer } from "@zoonk/utils/math-answer";
import { getOptionId } from "../../_utils/answer-options";
import { evaluateFormula } from "../../activities/expression/evaluate-expression";
import {
  type MathValues,
  RESULT_PLACEHOLDER,
  fillMathText,
  getValues,
} from "../../items/_utils/math-values";
import { checkItem } from "../../items/item-checks";
import { repairItem } from "../../items/item-repairs";

const MAX_WRONG_OPTIONS = 3;

export type MathCheckInput = {
  context: string | null;
  question: string;
  math: GeneratedMathProblem;
  correctReason: string;
};

type MathOption = { isCorrect: boolean; reason: string; text: string; value: number };

function toOption({
  isCorrect,
  language,
  reason,
  unit,
  value,
  values,
}: {
  isCorrect: boolean;
  language: string;
  reason: string;
  unit: string | null;
  value: number;
  values: MathValues;
}): MathOption {
  return {
    isCorrect,
    reason: fillMathText({
      language,
      text: reason,
      values: { ...values, [RESULT_PLACEHOLDER]: value },
    }).trim(),
    text: formatMathAnswer({ language, unit, value }),
    value,
  };
}

function getWrongOptions({
  correct,
  input,
  language,
  values,
}: {
  correct: MathOption;
  input: MathCheckInput;
  language: string;
  values: MathValues;
}): MathOption[] {
  const options = input.math.commonMistakes.flatMap((mistake) => {
    const result = evaluateFormula(mistake.expression, values);

    return result.ok && Number.isFinite(result.value)
      ? [
          toOption({
            isCorrect: false,
            language,
            reason: mistake.reason,
            unit: input.math.unit,
            value: result.value,
            values,
          }),
        ]
      : [];
  });

  const distinct = [...new Map(options.map((option) => [option.text, option])).values()];

  return distinct.filter((option) => option.text !== correct.text).slice(0, MAX_WRONG_OPTIONS);
}

function repairCalculation({
  input,
  language,
}: {
  input: MathCheckInput;
  language: string;
}): MathCheckInput {
  const { context, math, question } = input;

  const item = repairItem({
    item: { context, difficulty: "medium", format: "numeric", math, otherSolutions: [], question },
    language,
  });

  return item.format === "numeric"
    ? { ...input, context: item.context, math: item.math, question: item.question }
    : input;
}

export function toMathCheckContent({
  input: written,
  language,
}: {
  input: MathCheckInput;
  language: string;
}):
  | { ok: false; problems: string[] }
  | {
      ok: true;
      content: { basis: null; context?: string; options: object[]; question: string };
      item: Omit<MathCheckInput, "correctReason">;
    } {
  const input = repairCalculation({ input: written, language });
  const { context, math, question } = input;

  const problems = checkItem({
    expectedFormat: "numeric",
    item: { context, difficulty: "medium", format: "numeric", math, otherSolutions: [], question },
    language,
  });

  const values = getValues(math);
  const solution = evaluateFormula(math.solution, values);

  if (problems.length > 0 || !solution.ok) {
    return { ok: false, problems: problems.length > 0 ? problems : ["The solution fails."] };
  }

  const correct = toOption({
    isCorrect: true,
    language,
    reason: input.correctReason,
    unit: math.unit,
    value: solution.value,
    values,
  });

  const wrong = getWrongOptions({ correct, input, language, values });

  if (wrong.length === 0) {
    return {
      ok: false,
      problems: [
        "No common mistake gives a number different from the answer, so there's no wrong option.",
      ],
    };
  }

  const options = [correct, ...wrong]
    .toSorted((first, second) => first.value - second.value)
    .map((option, index) => ({
      id: getOptionId(index),
      isCorrect: option.isCorrect,
      reason: option.reason,
      text: option.text,
    }));

  const filledContext = context ? fillMathText({ language, text: context, values }).trim() : "";

  return {
    content: {
      basis: null,
      ...(filledContext ? { context: filledContext } : {}),
      options,
      question: fillMathText({ language, text: question, values }).trim(),
    },
    item: { context, math, question },
    ok: true,
  };
}
