import { normalizeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";
import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";
import { normalizeString } from "@zoonk/utils/string";
import { stripOptionLabels } from "../_utils/answer-options";
import { checkMathProblem } from "./item-math-checks";
import { optionsShowWorkedValues } from "./option-leaks";

type ItemOf<FORMAT extends GeneratedItem["format"]> = Extract<GeneratedItem, { format: FORMAT }>;
type Problem = string | false;

function isBlank(value: string | null | undefined): boolean {
  return !value?.trim();
}

function hasDuplicates(values: readonly string[], normalize = normalizeString): boolean {
  return new Set(values.map((value) => normalize(value))).size !== values.length;
}

function checkMultipleChoice(
  item: ItemOf<"multipleChoice">,
  optionCount: number | null,
): Problem[] {
  /** Checked as they're stored: without the letters a writer printed before them. */
  const options = stripOptionLabels(item.options);
  const texts = options.map((option) => option.text);
  const correct = options.filter((option) => option.isCorrect);
  const wrong = options.filter((option) => !option.isCorrect);

  return [
    correct.length !== 1 && `Has ${correct.length} correct options instead of 1.`,
    optionCount !== null &&
      options.length !== optionCount &&
      `Has ${options.length} options instead of ${optionCount}.`,
    hasDuplicates(texts) && "Two options are the same.",
    texts.some((text) => isBlank(text)) && "An option is empty.",
    options.some((option) => isBlank(option.reason)) && "An option has no reason.",
    wrong.some((option) => isBlank(option.misconception)) && "A wrong option has no misconception.",
    optionsShowWorkedValues({ options: texts, stem: `${item.context ?? ""} ${item.question}` }) &&
      "Options show the worked-out values that decide the answer.",
  ];
}

function checkTrueFalse(item: ItemOf<"trueFalse">): Problem[] {
  return [
    isBlank(item.statement) && "The statement is empty.",
    isBlank(item.reason) && "The statement has no reason.",
    !item.isTrue && isBlank(item.misconception) && "A false statement has no misconception.",
  ];
}

function checkOpenAnswer(item: ItemOf<"typed"> | ItemOf<"spoken">): Problem[] {
  return [
    item.keyPoints.length === 0 && "Has no key points.",
    item.keyPoints.some((keyPoint) => isBlank(keyPoint)) && "A key point is empty.",
    hasDuplicates(item.keyPoints) && "Two key points are the same.",
    hasDuplicates(item.acceptedAnswers, normalizeTypedAnswer) &&
      "Two accepted answers are the same.",
    isBlank(item.sampleAnswer) && "Has no sample answer.",
  ];
}

function checkEssay(item: ItemOf<"essay">): Problem[] {
  const pointed = item.rubric.filter((row) => row.points !== null).length;

  return [
    hasDuplicates(item.rubric.map((criterion) => criterion.criterion)) &&
      "Two rubric criteria are the same.",
    item.keyPoints.length === 0 && "Has no key points.",
    pointed > 0 && pointed < item.rubric.length && "Only some rubric rows have points.",
  ];
}

function checkMatchPairs(item: ItemOf<"matchPairs">): Problem[] {
  return [
    hasDuplicates(item.pairs.map((pair) => pair.left)) && "Two left items are the same.",
    hasDuplicates(item.pairs.map((pair) => pair.right)) && "Two right items are the same.",
  ];
}

function checkOrder(item: ItemOf<"order">): Problem[] {
  return [hasDuplicates(item.steps) && "Two steps are the same."];
}

function getQuestion(item: GeneratedItem): string {
  return item.format === "trueFalse" ? item.statement : item.question;
}

function checkFormat(item: GeneratedItem, optionCount: number | null): Problem[] {
  switch (item.format) {
    case "multipleChoice":
      return checkMultipleChoice(item, optionCount);
    case "trueFalse":
      return checkTrueFalse(item);
    case "typed":
    case "spoken":
      return checkOpenAnswer(item);
    case "essay":
      return checkEssay(item);
    case "matchPairs":
      return checkMatchPairs(item);
    case "order":
      return checkOrder(item);
    case "numeric":
      return checkMathProblem({ context: item.context, math: item.math, question: item.question });
    default:
      return [];
  }
}

/**
 * The code checks every item passes before it is stored: one right answer,
 * options a learner can tell apart, a reason and a misconception for every
 * wrong option, key points for open answers and math recomputed from its data.
 * Returns one line per problem, so an empty list means the item passes.
 */
export function checkItem({
  expectedFormat,
  item,
  optionCount = null,
}: {
  /** The format the item was generated for; a model can answer in the wrong one. */
  expectedFormat?: GeneratedItem["format"];
  item: GeneratedItem;
  /** Options every multiple-choice item must have, such as 5 for ENEM. */
  optionCount?: number | null;
}): string[] {
  return [
    expectedFormat !== undefined &&
      item.format !== expectedFormat &&
      `Is ${item.format} instead of ${expectedFormat}.`,
    isBlank(getQuestion(item)) && "The question is empty.",
    ...checkFormat(item, optionCount),
  ].filter((problem) => typeof problem === "string");
}
