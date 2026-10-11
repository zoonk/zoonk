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

/** A question needs at least this many options or pairs. */
const MIN_CHOICES = 2;

/** A variable as a text shows it, in braces: `{price}`. */
const BRACED_NAME = /\{(?<name>[A-Z_a-z]\w*)\}/gu;

/** Each value once, the first of those `key` reads the same. */
function uniqueBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  const keys = values.map((value) => key(value));
  return values.filter((_, index) => keys.indexOf(keys[index] ?? "") === index);
}

/**
 * The options without twins (`dropEquivalentOptions`), when what's left is still a whole question:
 * as many options as the exam's format asks for, or two or more when it asks for none.
 */
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

/** Whether an answer gives another one's value again: the same number, give or take float noise. */
function repeats(value: number, other: number | null): boolean {
  return other !== null && isClose(value, other);
}

/**
 * The other answers a numeric question takes, without one that only gives the solution's answer
 * again or an earlier one's, at the numbers it was checked with.
 */
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

/**
 * An expression names a variable bare (`price * 2`) where the text shows it in braces
 * (`{price}`), so braces a writer carried into an expression come off a declared name and the
 * math still checks. Anything else in braces is left for the checks to report.
 */
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

/**
 * What code repairs in a written item before its checks run, so a question isn't thrown away for
 * it: Markdown a learner would see as marks, taken out by how each text shows (`repairMarkdown`),
 * an option that says what another says (dropped while the question keeps the options its exam
 * asks for; of twins, the right one stays), a key point, accepted answer, rubric row or pair
 * written twice, and a math expression that names a variable in braces as the text does. Em dashes go when it's stored (`toStoredItem`). What code can't repair is left
 * for `checkItem` to report.
 */
export function repairItem<TItem extends GeneratedItem>({
  item,
  language,
  optionCount = null,
}: {
  item: TItem;
  language: string;
  /** Options every multiple-choice item must have, such as 5 for ENEM. */
  optionCount?: number | null;
}): TItem {
  const written = mapItemWriting(item, ({ layout, text }) => repairMarkdown({ layout, text }));

  // A repair keeps the item's format and fields, so it reads as the item it came from.
  return { ...item, ...repairAnswers({ item: written, language, optionCount }) };
}
