import { normalizeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";
import {
  type GeneratedItem,
  type NumericEntry,
  type OptionSelect,
} from "@zoonk/ai/tasks/v2/items/schemas";
import { normalizeString } from "@zoonk/utils/string";
import { findEmDashes, findPlaceholderText, findUnrenderedMarkdown } from "@zoonk/utils/text-flaws";
import { findOptionPositionReferences, stripOptionLabels } from "../_utils/answer-options";
import {
  findAnswerKeyProblems,
  findEquivalentOptions,
  findOptionDataProblems,
} from "../_utils/option-checks";
import { getVisualProblems } from "../quality/_utils/visual-references";
import { ANY_NUMBER } from "./_utils/numeric-entry";
import { isOwnWording } from "./item-content";
import { checkMathProblem } from "./item-math-checks";
import { getItemWriting } from "./item-writing";
import { optionsShowWorkedValues } from "./option-leaks";

type ItemOf<FORMAT extends GeneratedItem["format"]> = Extract<GeneratedItem, { format: FORMAT }>;
type Problem = string | false;

function isBlank(value: string | null | undefined): boolean {
  return !value?.trim();
}

function hasDuplicates(values: readonly string[], normalize = normalizeString): boolean {
  return new Set(values.map((value) => normalize(value))).size !== values.length;
}

/**
 * The right options a question needs for its picks: exactly one, exactly as many as "choose k"
 * asks for (with more options than that), or for "select all that apply" at least one right and
 * one wrong, so picking every option is never a sure answer.
 */
function checkPicks({
  options,
  select,
}: {
  options: readonly { isCorrect: boolean }[];
  select: OptionSelect;
}): Problem[] {
  const correct = options.filter((option) => option.isCorrect).length;

  if (select === "all") {
    return [
      correct === 0 && "Has no correct option.",
      correct === options.length &&
        "Has no wrong option, so selecting every option is always right.",
    ];
  }

  return [
    correct !== select && `Has ${correct} correct options instead of ${select}.`,
    select > 1 &&
      select >= options.length &&
      `Asks for ${select} picks out of ${options.length} options.`,
  ];
}

function checkMultipleChoice({
  item,
  language,
  optionCount,
  select,
}: {
  item: ItemOf<"multipleChoice">;
  language: string;
  optionCount: number | null;
  select: OptionSelect;
}): Problem[] {
  /** Checked as they're stored: without the letters a writer printed before them. */
  const options = stripOptionLabels(item.options);
  const texts = options.map((option) => option.text);
  const wrong = options.filter((option) => !option.isCorrect);
  const [position] = options.flatMap((option) => findOptionPositionReferences(option.reason));

  return [
    ...checkPicks({ options, select }),
    optionCount !== null &&
      options.length !== optionCount &&
      `Has ${options.length} options instead of ${optionCount}.`,
    ...findEquivalentOptions({ language, texts }),
    ...findOptionDataProblems({ data: [item.context, item.question], options: texts }),
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
    ...(isBlank(item.sampleAnswer) ? [] : findAnswerKeyProblems(item)),
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

/** Markdown a learner would see as marks, and text a writer left unfinished. */
function checkWriting(item: GeneratedItem): string[] {
  return getItemWriting(item).flatMap(({ layout, text }) => [
    ...findUnrenderedMarkdown({ layout, text }),
    ...findPlaceholderText(text),
  ]);
}

function checkFormat({
  entry,
  item,
  language,
  optionCount,
  select,
}: {
  entry: NumericEntry;
  item: GeneratedItem;
  language: string;
  optionCount: number | null;
  select: OptionSelect;
}): Problem[] {
  switch (item.format) {
    case "multipleChoice":
      return checkMultipleChoice({ item, language, optionCount, select });
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
      return checkMathProblem({
        context: item.context,
        entry,
        math: item.math,
        otherSolutions: item.otherSolutions,
        question: item.question,
      });
    default:
      return [];
  }
}

/**
 * The code checks every item passes before it is stored: as many right options
 * as the learner picks, options a learner can tell apart that agree with the
 * item's data, a reason and a misconception for every wrong option, key points
 * for open answers and a sample answer that gives an accepted one, math
 * recomputed from its data in a form its answer box takes, Markdown the player
 * renders, nothing left unfinished and every table, chart, timeline or picture
 * its words point at shown with it.
 * Returns one line per problem, so an empty list means the item passes.
 */
export function checkItem({
  entry = ANY_NUMBER,
  expectedFormat,
  item,
  language,
  optionCount = null,
  select = 1,
}: {
  /** How a numeric item's answer is typed, from the exam's format: any number by default. */
  entry?: NumericEntry;
  /** The format the item was generated for; a model can answer in the wrong one. */
  expectedFormat?: GeneratedItem["format"];
  item: GeneratedItem;
  /** The item's language, for the words that point at a table, chart or picture. */
  language: string;
  /** Options every multiple-choice item must have, such as 5 for ENEM. */
  optionCount?: number | null;
  /** How many options a multiple-choice learner picks, from the exam's format: one by default. */
  select?: OptionSelect;
}): string[] {
  return [
    expectedFormat !== undefined &&
      item.format !== expectedFormat &&
      `Is ${item.format} instead of ${expectedFormat}.`,
    isBlank(getQuestion(item)) && "The question is empty.",
    ...checkFormat({ entry, item, language, optionCount, select }),
    ...checkWriting(item),
    ...checkVisuals(item, language),
  ].filter((problem) => typeof problem === "string");
}

/**
 * The em dashes a written item has in our own wording, which storing it takes out
 * (`toStoredItem`), for evals to report what the writer should have avoided. A quoted past
 * question or an item citing the source it reproduces keeps every word, so it's never checked.
 */
export function findOwnEmDashes(item: GeneratedItem): string[] {
  return Object.entries(item).flatMap(([key, value]) =>
    isOwnWording(key) ? findEmDashes(value) : [],
  );
}
