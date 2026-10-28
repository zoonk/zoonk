import { normalizeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";
import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";
import { normalizeString } from "@zoonk/utils/string";
import { repairMarkdown } from "@zoonk/utils/text-repairs";
import { stripOptionLabels } from "../_utils/answer-options";
import { dropEquivalentOptions } from "../_utils/option-checks";
import { evaluateFormula } from "../activities/expression/evaluate-expression";
import { isClose } from "../activities/templates/_utils/template-helpers";
import { getValues } from "./_utils/math-values";
import { mapItemWriting } from "./item-writing";

type ItemOf<FORMAT extends GeneratedItem["format"]> = Extract<GeneratedItem, { format: FORMAT }>;

const MIN_CHOICES = 2;

const BRACED_NAME = /\{(?<name>[A-Z_a-z]\w*)\}/gu;

function uniqueBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  const keys = values.map((value) => key(value));
  return values.filter((_, index) => keys.indexOf(keys[index] ?? "") === index);
}

function repairOptions({
  item,
  language,
  optionCount,
}: {
  item: ItemOf<"multipleChoice">;
  language: string;
  optionCount: number | null;
}): ItemOf<"multipleChoice"> {
  const options = stripOptionLabels(item.options);
  const distinct = dropEquivalentOptions({ language, options });

  const whole =
    optionCount === null ? distinct.length >= MIN_CHOICES : distinct.length === optionCount;

  return distinct.length < options.length && whole ? { ...item, options: distinct } : item;
}

function repeats(value: number, other: number | null): boolean {
  return other !== null && isClose(value, other);
}

function repairOtherSolutions(item: ItemOf<"numeric">): ItemOf<"numeric"> {
  const values = getValues(item.math);

  const evaluate = (expression: string) => {
    const result = evaluateFormula(expression, values);
    return result.ok ? result.value : null;
  };

  const solution = evaluate(item.math.solution);

  const otherSolutions = item.otherSolutions.filter((expression, index) => {
    const value = evaluate(expression);
    const earlier = item.otherSolutions.slice(0, index).map((other) => evaluate(other));

    return (
      value === null ||
      !(repeats(value, solution) || earlier.some((other) => repeats(value, other)))
    );
  });

  return { ...item, otherSolutions };
}

function unbraceVariables(item: ItemOf<"numeric">): ItemOf<"numeric"> {
  const declared = new Set(item.math.variables.map((variable) => variable.name));

  const unbrace = (expression: string) =>
    expression.replaceAll(BRACED_NAME, (braced, name: string) =>
      declared.has(name) ? name : braced,
    );

  return {
    ...item,
    math: {
      ...item.math,
      commonMistakes: item.math.commonMistakes.map((mistake) => ({
        ...mistake,
        expression: unbrace(mistake.expression),
      })),
      solution: unbrace(item.math.solution),
      steps: item.math.steps.map((step) => ({
        ...step,
        expression: step.expression && unbrace(step.expression),
      })),
    },
    otherSolutions: item.otherSolutions.map((expression) => unbrace(expression)),
  };
}

function repairAnswers({
  item,
  language,
  optionCount,
}: {
  item: GeneratedItem;
  language: string;
  optionCount: number | null;
}): GeneratedItem {
  switch (item.format) {
    case "multipleChoice":
      return repairOptions({ item, language, optionCount });
    case "typed":
    case "spoken":
      return {
        ...item,
        acceptedAnswers: uniqueBy(item.acceptedAnswers, (answer) => normalizeTypedAnswer(answer)),
        keyPoints: uniqueBy(item.keyPoints, (point) => normalizeString(point)),
      };
    case "essay":
      return {
        ...item,
        keyPoints: uniqueBy(item.keyPoints, (point) => normalizeString(point)),
        rubric: uniqueBy(item.rubric, (row) =>
          [row.criterion, row.description, String(row.points)]
            .map((part) => normalizeString(part))
            .join("|"),
        ),
      };
    case "matchPairs": {
      const pairs = uniqueBy(
        item.pairs,
        (pair) => `${normalizeString(pair.left)}|${normalizeString(pair.right)}`,
      );

      return pairs.length >= MIN_CHOICES ? { ...item, pairs } : item;
    }
    case "numeric":
      return repairOtherSolutions(unbraceVariables(item));
    case "order":
    case "trueFalse":
      return item;
    default:
      throw new Error("Unknown item format.");
  }
}

export function repairItem<TItem extends GeneratedItem>({
  item,
  language,
  optionCount = null,
}: {
  item: TItem;
  language: string;
  optionCount?: number | null;
}): TItem {
  const written = mapItemWriting(item, ({ layout, text }) => repairMarkdown({ layout, text }));

  return { ...item, ...repairAnswers({ item: written, language, optionCount }) };
}
