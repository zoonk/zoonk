import { normalizeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";
import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";
import { normalizeString } from "@zoonk/utils/string";
import { findOptionPositionReferences, stripOptionLabels } from "../_utils/answer-options";
import { getVisualProblems } from "../quality/_utils/visual-references";
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
  const [position] = options.flatMap((option) => findOptionPositionReferences(option.reason));

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
    position !== undefined &&
      `A reason points at an option by its place ("${position}"); options are shuffled, so name it by what it says.`,
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

/** Every text a learner reads with the question: its support text, command and options. */
function getItemTexts(item: GeneratedItem): string[] {
  const context = "context" in item ? [item.context ?? ""] : [];

  switch (item.format) {
    case "multipleChoice":
      return [...context, item.question, ...item.options.map((option) => option.text)];
    case "matchPairs":
      return [item.question, ...item.pairs.flatMap((pair) => [pair.left, pair.right])];
    case "order":
      return [item.question, ...item.steps];
    case "trueFalse":
    case "typed":
    case "spoken":
    case "essay":
    case "numeric":
      return [...context, getQuestion(item)];
    default:
      throw new Error("Unknown item format.");
  }
}

/**
 * A question shows what its words point at: a table in Markdown in its context, a chart or a
 * timeline as its `visual`, and a picture (a diagram, a map, a figure) as its `image`, drawn before
 * it's stored. Formats without an `image` (math problems, whose numbers change every time,
 * matching, ordering, spoken and essay questions) ask another way.
 */
function checkVisuals(item: GeneratedItem, language: string): Problem[] {
  return getVisualProblems({
    canShowImage: "image" in item,
    language,
    shown: {
      hasImage: "image" in item && item.image !== null,
      texts: getItemTexts(item),
      visual: "visual" in item ? item.visual : null,
    },
  });
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
 * wrong option, key points for open answers, math recomputed from its data and
 * every table, chart, timeline or picture its words point at shown with it.
 * Returns one line per problem, so an empty list means the item passes.
 */
export function checkItem({
  expectedFormat,
  item,
  language,
  optionCount = null,
}: {
  /** The format the item was generated for; a model can answer in the wrong one. */
  expectedFormat?: GeneratedItem["format"];
  item: GeneratedItem;
  /** The item's language, for the words that point at a table, chart or picture. */
  language: string;
  /** Options every multiple-choice item must have, such as 5 for ENEM. */
  optionCount?: number | null;
}): string[] {
  return [
    expectedFormat !== undefined &&
      item.format !== expectedFormat &&
      `Is ${item.format} instead of ${expectedFormat}.`,
    isBlank(getQuestion(item)) && "The question is empty.",
    ...checkFormat(item, optionCount),
    ...checkVisuals(item, language),
  ].filter((problem) => typeof problem === "string");
}
