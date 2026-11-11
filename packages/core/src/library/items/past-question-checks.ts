import { type PastQuestion, type PastQuestionFormat } from "@zoonk/ai/tasks/items/past-questions";
import { NO_SPACE_SCRIPT } from "@zoonk/utils/string";
import { checkItem } from "./item-checks";
import { repairItem } from "./item-repairs";

const DASHES = /[-­‐-―−]/gu;
const SINGLE_QUOTES = /[‘’‚‛′]/gu;
const DOUBLE_QUOTES = /[“”„‟″]/gu;
const WHITESPACE = /\s+/gu;
const TABLE_DELIMITER_ROW = /^[|:]+$/u;
const LETTER = /\p{L}/u;
const LETTER_RUN = /[\p{L}\p{M}]+/gu;
const LOWERCASE = /\p{Ll}/u;
const PAGE_LINE = /[\n\f]/u;

/**
 * A page's own notes ("Use this space for computations.", a running header) repeat on every page,
 * which a question's text and a table's rows don't.
 */
const PAGE_NOTE_REPEATS = 3;

/**
 * Longer than the words the papers print (Portuguese ones stop near 18 letters), so in text that
 * lost its spaces it's words run together.
 */
const RUN_TOGETHER_LETTERS = 20;

/**
 * The PDF reader drops the spaces between words in some papers (Enem's), leaving a quarter of their
 * letters in hundreds of runs that long; a paper read well has a few at most, whatever its language.
 */
const LOST_SPACES_SHARE = 0.1;
const LOST_SPACES_RUNS = 5;

/** Spaces, line breaks, hyphens and quote marks vary with how the paper was read, not with its wording. */
function toComparableText(text: string): string {
  return text
    .normalize("NFKC")
    .replaceAll(SINGLE_QUOTES, "'")
    .replaceAll(DOUBLE_QUOTES, '"')
    .replaceAll(DASHES, "")
    .replaceAll(WHITESPACE, "");
}

function isPageNote(line: string, repeats: number): boolean {
  return repeats >= PAGE_NOTE_REPEATS && LETTER.test(line) && !line.includes("|");
}

/** The paper without its page notes, so a quote can leave them out and nothing else. */
function toComparablePaper(paperText: string): string {
  const lines = paperText.split(PAGE_LINE).map((line) => toComparableText(line));
  const repeats = Map.groupBy(lines, (line) => line);

  return lines.filter((line) => !isPageNote(line, repeats.get(line)?.length ?? 0)).join("");
}

/** A table's `| --- |` row is the formatting it needs to show as one, so it isn't compared. */
function toComparableQuote(text: string): string {
  return text
    .split("\n")
    .map((line) => toComparableText(line))
    .filter((line) => !TABLE_DELIMITER_ROW.test(line))
    .join("");
}

function findLetterRuns(text: string): string[] {
  return (text.match(LETTER_RUN) ?? []).filter((run) => !NO_SPACE_SCRIPT.test(run));
}

function countLetters(runs: string[]): number {
  return runs.reduce((total, run) => total + run.length, 0);
}

/** Capitals alone are a code or a sequence ("AUGGCCAUUGUAAUGGGCCGC"), not words run together. */
function isRunTogether(run: string): boolean {
  return run.length >= RUN_TOGETHER_LETTERS && LOWERCASE.test(run);
}

function hasLostSpaces(paperText: string): boolean {
  const runs = findLetterRuns(paperText);
  const letters = countLetters(runs);
  const runTogether = runs.filter((run) => isRunTogether(run));

  return (
    runTogether.length >= LOST_SPACES_RUNS &&
    countLetters(runTogether) >= LOST_SPACES_SHARE * letters
  );
}

function findRunTogetherWords(text: string): string[] {
  return findLetterRuns(text).filter((run) => isRunTogether(run));
}

function isQuoted({ paper, text }: { paper: string; text: string }): boolean {
  const quote = toComparableQuote(text);
  return quote.length > 0 && paper.includes(quote);
}

function getQuotedParts(item: PastQuestion["item"]): { label: string; text: string }[] {
  const context = item.context ? [{ label: "The support text", text: item.context }] : [];

  if (item.format === "trueFalse") {
    return [...context, { label: "The statement", text: item.statement }];
  }

  return [
    ...context,
    { label: "The command", text: item.question },
    ...item.options.map((option, index) => ({ label: `Option ${index + 1}`, text: option.text })),
  ];
}

function findQuoteProblems({
  paperText,
  question,
}: {
  paperText: string;
  question: PastQuestion;
}): string[] {
  const paper = toComparablePaper(paperText);
  const lostSpaces = hasLostSpaces(paperText);

  return getQuotedParts(question.item).flatMap(({ label, text }) => {
    const runTogether = lostSpaces ? findRunTogetherWords(text) : [];

    return [
      ...(isQuoted({ paper, text }) ? [] : [`${label} isn't in the paper as printed.`]),
      ...runTogether.map(
        (run) => `${label} runs words together as the paper's text does: "${run}".`,
      ),
    ];
  });
}

/** The import and its eval run this one gate: repair what code can, then check the rest. */
export function checkPastQuestion({
  paperText,
  question: written,
  target,
}: {
  paperText: string;
  question: PastQuestion;
  target: {
    format: PastQuestionFormat;
    language: string;
    optionCount: number | null;
    skillCount: number;
  };
}): { problems: string[]; question: PastQuestion } {
  const { format, language, optionCount, skillCount } = target;
  const item = repairItem({ item: written.item, language, optionCount });
  const question = { ...written, item };
  const number = question.number.trim();
  const citesNumber = number.length > 0 && question.citation.includes(number);
  const hasSkill = question.skill >= 1 && question.skill <= skillCount;
  const asksForPicture = "image" in item && item.image !== null;

  const problems = [
    ...checkItem({ expectedFormat: format, item, language, optionCount }),
    ...findQuoteProblems({ paperText, question }),
    ...(citesNumber ? [] : ["The citation doesn't name the question's number."]),
    ...(hasSkill ? [] : ["The question isn't tagged with one of the skills."]),
    ...(asksForPicture ? ["The question depends on a figure, which can't be copied."] : []),
  ];

  return { problems, question };
}
